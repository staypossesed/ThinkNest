import { FastifyInstance } from "fastify";

export async function registerPortalRoutes(app: FastifyInstance): Promise<void> {
  app.get("/portal", async (_request, reply) => {
    return reply.type("text/html").send(buildPortalHtml());
  });
}

function buildPortalHtml(): string {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Multi Agent Portal</title>
    <style>
      :root {
        --bg: #0b0d12;
        --card: #161b22;
        --border: rgba(255,255,255,.08);
        --text: #e5e7eb;
        --muted: #9ca3af;
        --accent: #6366f1;
        --ok: #34d399;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, Segoe UI, system-ui, sans-serif;
        background: var(--bg);
        color: var(--text);
      }
      .layout { display: grid; grid-template-columns: 260px 1fr; min-height: 100vh; }
      .sidebar {
        border-right: 1px solid var(--border);
        padding: 20px 16px;
        background: #0f141c;
      }
      .brand { font-weight: 700; font-size: 18px; margin-bottom: 18px; }
      .chip {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 6px 10px; border-radius: 999px; background: rgba(99,102,241,.18);
        color: #c7d2fe; font-size: 12px; font-weight: 600;
      }
      .muted { color: var(--muted); font-size: 13px; margin-top: 10px; line-height: 1.4; }
      main { padding: 30px; }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 18px;
        margin-bottom: 16px;
      }
      h1 { margin: 0 0 8px; font-size: 24px; }
      p { margin: 0; }
      .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
      button {
        border: none; border-radius: 10px; padding: 10px 14px; cursor: pointer;
        background: var(--accent); color: white; font-weight: 600;
      }
      button.secondary { background: #263246; color: #d1d5db; }
      button:disabled { opacity: .5; cursor: not-allowed; }
      .ok { color: var(--ok); font-weight: 600; }
      .err { color: #f87171; margin-top: 10px; font-size: 14px; }
      .line { margin-top: 8px; color: var(--muted); font-size: 14px; }
      code { background: rgba(0,0,0,.25); padding: 2px 6px; border-radius: 6px; }
    </style>
  </head>
  <body>
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">Multi Agent</div>
        <div id="leftName" class="chip">Guest</div>
        <div class="muted">Статус: <span id="leftPlan">free</span></div>
      </aside>
      <main>
        <div class="card">
          <h1>Login & Billing</h1>
          <p class="line">Одностраничный портал: Google вход + апгрейд до Pro.</p>
          <div class="row">
            <button id="loginBtn">Войти через Google</button>
            <button id="upgradeBtn" class="secondary" disabled>Upgrade to Pro</button>
            <button id="manageBtn" class="secondary" disabled>Manage billing</button>
            <button id="logoutBtn" class="secondary" disabled>Выйти</button>
          </div>
          <div id="status" class="line">Не авторизован.</div>
          <div id="error" class="err"></div>
        </div>
        <div class="card">
          <p class="line">После входа ты увидишь короткое имя и статус (free/pro) слева.</p>
          <p class="line">Для desktop можно использовать тот же backend и те же endpoints.</p>
          <p class="line">URL: <code>/portal</code></p>
        </div>
      </main>
    </div>

    <script>
      const tokenKey = "mad_portal_token";
      const loginBtn = document.getElementById("loginBtn");
      const upgradeBtn = document.getElementById("upgradeBtn");
      const manageBtn = document.getElementById("manageBtn");
      const logoutBtn = document.getElementById("logoutBtn");
      const statusEl = document.getElementById("status");
      const errorEl = document.getElementById("error");
      const leftNameEl = document.getElementById("leftName");
      const leftPlanEl = document.getElementById("leftPlan");

      function setError(msg) { errorEl.textContent = msg || ""; }

      function shortName(user) {
        if (!user) return "Guest";
        if (user.fullName) return user.fullName.trim().split(/\\s+/)[0];
        if (user.email) return user.email.split("@")[0];
        return "User";
      }

      function authHeaders() {
        const token = localStorage.getItem(tokenKey);
        return token ? { Authorization: "Bearer " + token } : {};
      }

      async function api(path, init = {}) {
        const res = await fetch(path, {
          ...init,
          headers: { "Content-Type": "application/json", ...(init.headers || {}), ...authHeaders() }
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (!res.ok) throw new Error(data.error || data.message || ("HTTP " + res.status));
        return data;
      }

      async function bootstrapFromCallback() {
        const url = new URL(window.location.href);
        const state = url.searchParams.get("state");
        const authError = url.searchParams.get("authError");
        if (authError) {
          setError("Google login failed: " + authError);
          return;
        }
        if (!state) return;
        for (let i = 0; i < 10; i++) {
          const poll = await api("/auth/google/poll?state=" + encodeURIComponent(state));
          if (poll.status === "success" && poll.token) {
            localStorage.setItem(tokenKey, poll.token);
            url.searchParams.delete("state");
            window.history.replaceState({}, "", url.pathname);
            return;
          }
          if (poll.status === "error") throw new Error(poll.error || "Auth poll failed");
          await new Promise(r => setTimeout(r, 500));
        }
        throw new Error("Auth timeout. Retry login.");
      }

      async function refreshProfile() {
        const token = localStorage.getItem(tokenKey);
        if (!token) {
          leftNameEl.textContent = "Guest";
          leftPlanEl.textContent = "free";
          statusEl.textContent = "Не авторизован.";
          upgradeBtn.disabled = true;
          manageBtn.disabled = true;
          logoutBtn.disabled = true;
          return;
        }

        const me = await api("/me");
        const ent = await api("/entitlements");
        const plan = (ent.plan || "free").toLowerCase();
        leftNameEl.textContent = shortName(me);
        leftPlanEl.textContent = plan;
        statusEl.innerHTML = "Вход: <strong>" + me.email + "</strong> · План: <span class='ok'>" + plan + "</span>";
        upgradeBtn.disabled = plan === "pro";
        manageBtn.disabled = false;
        logoutBtn.disabled = false;
      }

      loginBtn.onclick = async () => {
        try {
          setError("");
          const start = await api("/auth/google/start?mode=web&redirect=/portal");
          window.location.href = start.authUrl;
        } catch (e) {
          setError(e.message || String(e));
        }
      };

      upgradeBtn.onclick = async () => {
        try {
          setError("");
          const res = await api("/billing/checkout", { method: "POST" });
          window.location.href = res.url;
        } catch (e) {
          setError(e.message || String(e));
        }
      };

      manageBtn.onclick = async () => {
        try {
          setError("");
          const res = await api("/billing/portal", { method: "POST" });
          window.location.href = res.url;
        } catch (e) {
          setError(e.message || String(e));
        }
      };

      logoutBtn.onclick = async () => {
        try {
          setError("");
          localStorage.removeItem(tokenKey);
          await refreshProfile();
        } catch (e) {
          setError(e.message || String(e));
        }
      };

      (async function init() {
        try {
          await bootstrapFromCallback();
          await refreshProfile();
        } catch (e) {
          setError(e.message || String(e));
        }
      })();
    </script>
  </body>
</html>`;
}
