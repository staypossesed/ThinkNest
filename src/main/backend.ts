import path from "node:path";
import { promises as fs } from "node:fs";
import { app, shell } from "electron";
import {
  CanAskResponse,
  ConsumeUsageResponse,
  Entitlements,
  SessionState,
  UserProfile
} from "../shared/types";

const backendBaseUrl = process.env.BACKEND_API_URL ?? "http://localhost:8787";
const sessionFilePath = path.join(app.getPath("userData"), "session.json");

/** Режим разработки: без backend, 4 агента, без лимитов. Для тестирования и доработки. */
export const isDevMode =
  process.env.DEV_MODE === "true" || process.env.NODE_ENV === "development";

const DEV_USER: UserProfile = {
  id: "dev",
  email: "dev@local",
  fullName: "Режим разработки",
  avatarUrl: null
};

const DEV_ENTITLEMENTS: Entitlements = {
  plan: "pro",
  maxAgents: 4,
  periodType: "monthly",
  maxQuestions: 9999,
  usedQuestions: 0,
  remainingQuestions: 9999,
  allowWebData: true,
  allowForecast: true,
  allowDebate: true,
  allowExpertProfile: true,
  allowMemory: true
};

class BackendClient {
  private token: string | null = null;
  private user: UserProfile | null = null;

  async init(): Promise<void> {
    try {
      const raw = await fs.readFile(sessionFilePath, "utf8");
      const parsed = JSON.parse(raw) as SessionState;
      this.token = parsed.token;
      this.user = parsed.user;
    } catch {
      this.token = null;
      this.user = null;
    }
  }

  async getSession(): Promise<SessionState> {
    if (isDevMode) {
      return { token: "dev", user: DEV_USER };
    }
    if (!this.token) {
      return { token: null, user: null };
    }

    try {
      const profile = await this.request<UserProfile>("/me", { method: "GET" }, true);
      this.user = { ...profile, locale: this.user?.locale ?? profile.locale };
      await this.persistSession();
      return { token: this.token, user: this.user };
    } catch {
      await this.clearSession();
      return { token: null, user: null };
    }
  }

  async loginWithGoogle(): Promise<SessionState> {
    if (isDevMode) {
      return { token: "dev", user: DEV_USER };
    }
    const start = await this.request<{ state: string; authUrl: string }>(
      "/auth/google/start",
      { method: "GET" },
      false
    );

    await shell.openExternal(start.authUrl);
    const { token, locale } = await this.pollAuthToken(start.state);
    this.token = token;
    const profile = await this.request<UserProfile>("/me", { method: "GET" }, true);
    this.user = { ...profile, locale };
    await this.persistSession();
    return { token: this.token, user: this.user };
  }

  async logout(): Promise<void> {
    if (this.token) {
      try {
        await this.request("/auth/logout", { method: "POST" }, true);
      } catch {
        // Ignore backend logout errors and clear local session anyway.
      }
    }
    await this.clearSession();
  }

  async getEntitlements(): Promise<Entitlements> {
    if (isDevMode) return { ...DEV_ENTITLEMENTS };
    return this.request<Entitlements>("/entitlements", { method: "GET" }, true);
  }

  async canAsk(): Promise<CanAskResponse> {
    if (isDevMode) {
      return { allowed: true, reason: null, entitlements: { ...DEV_ENTITLEMENTS } };
    }
    return this.request<CanAskResponse>("/usage/can-ask", { method: "POST" }, true);
  }

  async consumeUsage(question: string): Promise<ConsumeUsageResponse> {
    if (isDevMode) {
      return { ok: true, entitlements: { ...DEV_ENTITLEMENTS } };
    }
    return this.request<ConsumeUsageResponse>(
      "/usage/consume",
      {
        method: "POST",
        body: JSON.stringify({ question })
      },
      true
    );
  }

  async createCheckoutUrl(): Promise<string> {
    if (isDevMode) {
      throw new Error("Режим разработки: оплата отключена.");
    }
    const response = await this.request<{ url: string | null }>(
      "/billing/checkout",
      { method: "POST" },
      true
    );
    if (!response.url) {
      throw new Error("Stripe checkout URL is missing.");
    }
    return response.url;
  }

  async createPortalUrl(): Promise<string> {
    if (isDevMode) {
      throw new Error("Режим разработки: управление подпиской отключено.");
    }
    const response = await this.request<{ url: string | null }>(
      "/billing/portal",
      { method: "POST" },
      true
    );
    if (!response.url) {
      throw new Error("Stripe portal URL is missing.");
    }
    return response.url;
  }

  private async pollAuthToken(
    state: string
  ): Promise<{ token: string; locale?: string }> {
    for (let i = 0; i < 120; i += 1) {
      const response = await this.request<{
        status: string;
        token?: string;
        locale?: string;
        error?: string;
      }>(`/auth/google/poll?state=${encodeURIComponent(state)}`, { method: "GET" }, false);

      if (response.status === "success" && response.token) {
        return { token: response.token, locale: response.locale };
      }
      if (response.status === "error") {
        throw new Error(response.error ?? "Google login failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Google login timed out. Try again.");
  }

  private async request<T = unknown>(
    pathName: string,
    init: RequestInit,
    withAuth: boolean
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type") && init.body) {
      headers.set("Content-Type", "application/json");
    }
    if (withAuth) {
      if (!this.token) {
        throw new Error("Требуется вход через Google.");
      }
      headers.set("Authorization", `Bearer ${this.token}`);
    }

    const response = await fetch(`${backendBaseUrl}${pathName}`, {
      ...init,
      headers
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === "string"
          ? payload
          : ((payload as { error?: string; message?: string }).error ??
            (payload as { message?: string }).message ??
            `Backend error ${response.status}`);
      throw new Error(message);
    }

    return payload as T;
  }

  private async persistSession(): Promise<void> {
    const data: SessionState = {
      token: this.token,
      user: this.user
    };
    await fs.writeFile(sessionFilePath, JSON.stringify(data, null, 2), "utf8");
  }

  private async clearSession(): Promise<void> {
    this.token = null;
    this.user = null;
    try {
      await fs.unlink(sessionFilePath);
    } catch {
      // Ignore if session file does not exist.
    }
  }
}

export const backendClient = new BackendClient();
