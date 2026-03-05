import { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
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
        : "/portal";
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
        return reply
          .code(400)
          .type("text/html")
          .send(
            `<script>window.location.href='${pending.redirectPath ?? "/portal"}?authError=${encodeURIComponent(
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
        return reply
          .code(200)
          .type("text/html")
          .send(
            `<script>window.location.href='${pending.redirectPath ?? "/portal"}?state=${encodeURIComponent(
              query.state
            )}'</script>`
          );
      }

      return reply
        .code(200)
        .type("text/html")
        .send("<h2>Login successful. Return to the app.</h2>");
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
