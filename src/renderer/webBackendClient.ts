/**
 * Web backend client — реальные запросы к API при открытии с хоста (мобилка, PWA).
 */
import type {
  AgentAnswer,
  AskRequest,
  AskResponse,
  CanAskResponse,
  ConsumeUsageResponse,
  Entitlements,
  SessionState
} from "../shared/types";
import { debug, debugError, debugWarn } from "./debug";

const TOKEN_KEY = "thinknest_web_token";

/**
 * Base URL for backend API. Empty = same origin (Vite proxy).
 * Set VITE_BACKEND_URL for custom backend (e.g. production).
 */
function getBackendUrl(): string {
  const env = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (env && env.trim()) return env.replace(/\/$/, "");
  return "";
}

/** Заголовок для обхода ngrok interstitial (free tier) */
function ngrokHeaders(): Record<string, string> {
  return window.location.hostname.includes("ngrok")
    ? { "ngrok-skip-browser-warning": "1" }
    : {};
}

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean }
): Promise<T> {
  const { auth = true, ...init } = options;
  const url = `${getBackendUrl()}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...ngrokHeaders(),
    ...(init.headers as Record<string, string>)
  };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    debugWarn("webBackend", "request 401", { path: url });
    setToken(null);
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    debugWarn("webBackend", "request error", { path: url, status: res.status, text: text.slice(0, 100) });
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

const emptySession: SessionState = { token: null, user: null };

export async function webGetSession(): Promise<SessionState> {
  const token = getToken();
  debug("webBackend", "getSession", { hasToken: !!token, tokenLen: token?.length ?? 0 });
  if (!token) return emptySession;
  try {
    const profile = await request<{ id: string; email: string; fullName: string | null; avatarUrl: string | null }>(
      "/me",
      { method: "GET" }
    );
    debug("webBackend", "getSession success", { email: profile?.email });
    return {
      token,
      user: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl
      }
    };
  } catch (e) {
    debugWarn("webBackend", "getSession failed", e);
    return emptySession;
  }
}

export async function webLoginWithGoogle(): Promise<SessionState> {
  const redirect = window.location.origin + window.location.pathname + window.location.search;
  debug("webBackend", "loginWithGoogle", { redirect });
  const start = await request<{ state: string; authUrl: string }>(
    `/auth/google/start?mode=web&redirect=${encodeURIComponent(redirect)}`,
    { method: "GET", auth: false }
  );
  debug("webBackend", "loginWithGoogle redirecting to", start.authUrl?.slice(0, 60) + "...");
  window.location.href = start.authUrl;
  return emptySession;
}

export async function webLogout(): Promise<void> {
  try {
    await request("/auth/logout", { method: "POST", body: "{}" });
  } catch {}
  setToken(null);
}

export async function webGetEntitlements(): Promise<Entitlements> {
  return request("/entitlements", { method: "GET" });
}

export async function webCanAsk(): Promise<CanAskResponse> {
  return request("/usage/can-ask", { method: "POST", body: "{}" });
}

export async function webConsumeUsage(question: string): Promise<ConsumeUsageResponse> {
  return request("/usage/consume", {
    method: "POST",
    body: JSON.stringify({ question })
  });
}

export async function webGetSubscription(): Promise<{
  active: boolean;
  plan: string | null;
  interval: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}> {
  try {
    return await request("/billing/subscription", { method: "GET" });
  } catch {
    return { active: false, plan: null, interval: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }
}

export async function webOpenCheckout(plan: "weekly" | "monthly" | "yearly"): Promise<void> {
  const res = await request<{ url: string | null }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ plan })
  });
  if (res?.url) window.open(res.url, "_blank");
}

export async function webOpenPortal(): Promise<void> {
  const res = await request<{ url: string }>("/billing/portal", { method: "POST" });
  if (res?.url) window.open(res.url, "_blank");
}

export async function webAsk(
  payload: AskRequest,
  onAnswer?: (answer: AgentAnswer) => void
): Promise<AskResponse> {
  debug("webBackend", "ask", { question: payload.question?.slice(0, 50), hasToken: !!getToken() });
  try {
    const res = await request<AskResponse>("/ask", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    debug("webBackend", "ask success", { answersCount: res.answers?.length, hasFinal: !!res.final });
    for (const a of res.answers) onAnswer?.(a);
    return res;
  } catch (e) {
    debugError("webBackend", "ask failed", e);
    throw e;
  }
}

export async function webCheckBackend(): Promise<boolean> {
  const base = getBackendUrl();
  const url = `${base || ""}/health`;
  debug("webBackend", "checkBackend", { url: url || "(same-origin /health)" });
  const opts = { headers: ngrokHeaders(), signal: AbortSignal.timeout(5000) };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.ok === true || data?.service) {
          debug("webBackend", "checkBackend ok", { attempt: attempt + 1 });
          return true;
        }
      }
      debugWarn("webBackend", "checkBackend non-ok", { status: res.status, attempt: attempt + 1 });
    } catch (e) {
      debugWarn("webBackend", "checkBackend error", { attempt: attempt + 1, error: e });
      if (attempt < 2) await new Promise((r) => setTimeout(r, 300));
    }
  }
  debug("webBackend", "checkBackend false");
  return false;
}

export function webCompleteAuth(): boolean {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state");
  const authError = params.get("authError");
  debug("webBackend", "completeAuth", { hasState: !!state, authError });
  if (authError) {
    debugWarn("webBackend", "completeAuth authError", authError);
    window.history.replaceState({}, "", window.location.pathname);
    return false;
  }
  if (!state) return false;
  window.history.replaceState({}, "", window.location.pathname);
  pollAuthToken(state).then((token) => {
    debug("webBackend", "completeAuth poll done", { gotToken: !!token });
    if (token) setToken(token);
    window.location.reload();
  });
  return true;
}

async function pollAuthToken(state: string): Promise<string | null> {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await request<{ status: string; token?: string }>(
        `/auth/google/poll?state=${state}`,
        { method: "GET", auth: false }
      );
      if (res.status === "success" && res.token) return res.token;
      if (res.status === "error") return null;
    } catch {
      return null;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}
