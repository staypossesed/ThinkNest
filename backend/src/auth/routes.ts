import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "../config";
import { supabase, DbUser } from "../db";
import { createGoogleAuthUrl, exchangeCodeForTokens, getGoogleUserInfo } from "./google";
import { createSessionToken } from "./jwt";

interface PendingAuthState {
  createdAt: number;
  done: boolean;
  token?: string;
  locale?: string;
  error?: string;
  mode: "desktop" | "web";
  redirectPath?: string;
}

const pendingAuthStates = new Map<string, PendingAuthState>();

function cleanOldAuthStates(): void {
  const now = Date.now();
  for (const [state, value] of pendingAuthStates.entries()) {
    if (now - value.createdAt > 10 * 60 * 1000) {
      pendingAuthStates.delete(state);
    }
  }
}

async function upsertUser(input: {
  email: string;
  googleSub: string;
  fullName: string | null;
  avatarUrl: string | null;
}): Promise<DbUser> {
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        email: input.email,
        google_sub: input.googleSub,
        full_name: input.fullName,
        avatar_url: input.avatarUrl
      },
      { onConflict: "google_sub" }
    )
    .select("id,email,google_sub,full_name,avatar_url,stripe_customer_id")
    .single<DbUser>();

  if (error || !data) {
    throw new Error(`Failed to upsert user: ${error?.message ?? "unknown"}`);
  }
  return data;
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  /** Для отладки redirect_uri_mismatch: проверь, что этот URL добавлен в Google Console */
  app.get("/auth/google/redirect-uri", async () => {
    return { redirect_uri: config.GOOGLE_REDIRECT_URI };
  });

  app.get("/auth/google/start", async (request) => {
    const query = z
      .object({
        mode: z.enum(["desktop", "web"]).optional(),
        redirect: z.string().optional()
      })
      .parse(request.query);

    cleanOldAuthStates();
    const state = randomUUID();
    const redirectPath =
      query.redirect?.startsWith("http") ? query.redirect
        : query.redirect?.startsWith("/") ? query.redirect
        : "/";
    pendingAuthStates.set(state, {
      createdAt: Date.now(),
      done: false,
      mode: query.mode ?? "desktop",
      redirectPath
    });
    return { state, authUrl: createGoogleAuthUrl(state) };
  });

  app.get("/auth/google/poll", async (request, reply) => {
    const query = z.object({ state: z.string().uuid() }).parse(request.query);
    const pending = pendingAuthStates.get(query.state);
    if (!pending) {
      return reply.code(404).send({ status: "missing" });
    }
    if (!pending.done) {
      return { status: "pending" };
    }
    pendingAuthStates.delete(query.state);
    if (pending.error) {
      return { status: "error", error: pending.error };
    }
    return { status: "success", token: pending.token, locale: pending.locale };
  });

  app.get("/auth/google/callback", async (request, reply) => {
    const query = z
      .object({
        state: z.string().uuid(),
        code: z.string().optional(),
        error: z.string().optional()
      })
      .parse(request.query);

    const pending = pendingAuthStates.get(query.state);
    if (!pending) {
      return reply.code(400).type("text/html").send("<h2>State expired. Close this tab.</h2>");
    }

    if (query.error || !query.code) {
      pending.done = true;
      pending.error = query.error ?? "Missing code";
      if (pending.mode === "web") {
        const errAppUrl =
          pending.redirectPath?.startsWith("http")
            ? pending.redirectPath
            : `${config.APP_ORIGIN.replace(/\/$/, "")}${(pending.redirectPath ?? "/").startsWith("/") ? pending.redirectPath : "/"}`;
        return reply
          .code(400)
          .type("text/html")
          .send(
            `<script>window.location.href='${errAppUrl.replace(/'/g, "\\'")}?authError=${encodeURIComponent(
              pending.error
            )}'</script>`
          );
      }
      return reply
        .code(400)
        .type("text/html")
        .send("<h2>Google login failed. You can close this tab.</h2>");
    }

    try {
      const tokens = await exchangeCodeForTokens(query.code);
      const profile = await getGoogleUserInfo(tokens.access_token);
      const user = await upsertUser({
        email: profile.email,
        googleSub: profile.sub,
        fullName: profile.name ?? null,
        avatarUrl: profile.picture ?? null
      });

      const token = await createSessionToken({ sub: user.id, email: user.email });
      pending.done = true;
      pending.token = token;
      pending.locale = profile.locale ?? undefined;

      if (pending.mode === "web") {
        const appUrl =
          pending.redirectPath?.startsWith("http")
            ? pending.redirectPath
            : `${config.APP_ORIGIN.replace(/\/$/, "")}${pending.redirectPath?.startsWith("/") ? pending.redirectPath : "/"}`;
        const redirectUrl = `${appUrl}${appUrl.includes("?") ? "&" : "?"}state=${encodeURIComponent(query.state)}`;
        return reply
          .code(200)
          .type("text/html")
          .send(
            `<script>window.location.href='${redirectUrl.replace(/'/g, "\\'")}'</script>`
          );
      }

      const messages: Record<string, { title: string; subtitle: string; hint: string }> = {
        ru: { title: "Вход выполнен", subtitle: "Закройте эту вкладку и вернитесь в приложение.", hint: "Ctrl+W или крестик вкладки" },
        en: { title: "Login successful", subtitle: "Close this tab and return to the app.", hint: "Ctrl+W or close the tab" },
        zh: { title: "登录成功", subtitle: "关闭此标签页并返回应用。", hint: "Ctrl+W 或点击标签页关闭" },
        es: { title: "Inicio de sesión exitoso", subtitle: "Cierra esta pestaña y vuelve a la aplicación.", hint: "Ctrl+W o cerrar la pestaña" },
        de: { title: "Anmeldung erfolgreich", subtitle: "Schließen Sie diesen Tab und kehren Sie zur App zurück.", hint: "Strg+W oder Tab schließen" },
        fr: { title: "Connexion réussie", subtitle: "Fermez cet onglet et revenez à l'application.", hint: "Ctrl+W ou fermer l'onglet" }
      };
      let locale = (pending.locale ?? "").toLowerCase().slice(0, 2);
      if (!locale && request.headers["accept-language"]) {
        const first = request.headers["accept-language"].split(",")[0]?.split("-")[0]?.trim();
        if (first) locale = first.toLowerCase().slice(0, 2);
      }
      if (!locale || !messages[locale]) locale = "en";
      const msg = messages[locale] ?? messages.en;

      const monkeyLogo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="96" height="96" style="display:block;margin:0 auto">
  <circle cx="32" cy="36" r="20" fill="#e879f9"/>
  <circle cx="32" cy="36" r="14" fill="#f5d0fe"/>
  <circle cx="26" cy="32" r="3" fill="#0c0e12"/>
  <circle cx="38" cy="32" r="3" fill="#0c0e12"/>
  <path d="M28 42 Q32 46 36 42" stroke="#0c0e12" stroke-width="2" fill="none"/>
  <ellipse cx="32" cy="20" rx="8" ry="6" fill="#e879f9"/>
</svg>`;

      return reply
        .code(200)
        .type("text/html")
        .send(
          `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${msg.title} — ThinkNest</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap" rel="stylesheet">
  <style>.subtitle{color:#9ca3af;text-decoration:underline;text-underline-offset:4px;cursor:default}.subtitle:hover{color:#e5e7eb}</style>
</head>
<body style="margin:0;min-height:100vh;background:linear-gradient(135deg,#0b0d12 0%,#1a1d26 50%,#0f1219 100%);font-family:'Inter',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;color:#e5e7eb">
  <div style="text-align:center;padding:48px 32px;max-width:420px">
    ${monkeyLogo}
    <h1 style="margin:24px 0 8px;font-size:32px;font-weight:700;letter-spacing:-0.03em">ThinkNest</h1>
    <p style="margin:0 0 20px;font-size:18px;font-weight:600;color:#a78bfa">${msg.title}</p>
    <p class="subtitle" style="margin:0;font-size:15px;line-height:1.5">${msg.subtitle}</p>
    <p style="margin:12px 0 0;font-size:13px;color:#6b7280">${msg.hint}</p>
  </div>
</body>
</html>`
        );
    } catch (error) {
      pending.done = true;
      pending.error = error instanceof Error ? error.message : "Unknown error";
      return reply.code(500).type("text/html").send("<h2>Login failed. Close this tab.</h2>");
    }
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request) => {
    const { data, error } = await supabase
      .from("users")
      .select("id,email,google_sub,full_name,avatar_url,stripe_customer_id")
      .eq("id", request.user!.id)
      .single<DbUser>();
    if (error || !data) {
      throw new Error(`Failed to load user: ${error?.message ?? "unknown"}`);
    }
    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      avatarUrl: data.avatar_url
    };
  });

  app.post("/auth/logout", { preHandler: [app.authenticate] }, async () => {
    return { ok: true };
  });

}
