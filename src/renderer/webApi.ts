/**
 * Web API adapter — реальный backend при доступе с хоста (мобилка, PWA).
 * Fallback на демо, если backend недоступен.
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
import {
  webAsk,
  webCanAsk,
  webCheckBackend,
  webCompleteAuth,
  webConsumeUsage,
  webGetEntitlements,
  webGetSession,
  webLoginWithGoogle,
  webLogout
} from "./webBackendClient";

const DEMO_ENTITLEMENTS: Entitlements = {
  plan: "free",
  maxAgents: 2,
  periodType: "daily",
  maxQuestions: 15,
  usedQuestions: 0,
  remainingQuestions: 15,
  allowWebData: false,
  allowForecast: false,
  allowDebate: false,
  allowExpertProfile: false,
  allowMemory: false
};

function isProductionHost(): boolean {
  const h = typeof window !== "undefined" ? window.location.hostname : "";
  return h !== "localhost" && h !== "127.0.0.1";
}

function getDemoAnswers(): AgentAnswer[] {
  const prod = isProductionHost();
  if (prod) {
    return [
      { id: "planner", title: "Планировщик", content: "📋 Сервис временно недоступен.", model: "demo", durationMs: 0 },
      { id: "critic", title: "Критик", content: "🔍 Попробуйте позже или войдите через Google.", model: "demo", durationMs: 0 },
      { id: "pragmatist", title: "Практик", content: "⚡ Войдите через Google, чтобы задавать вопросы.", model: "demo", durationMs: 0 },
      { id: "explainer", title: "Объяснитель", content: "📖 Или установите десктопное приложение.", model: "demo", durationMs: 0 }
    ];
  }
  return [
    { id: "planner", title: "Планировщик", content: "📋 Запустите: npm run dev:backend и npm run dev:renderer. Перезагрузите страницу.", model: "demo", durationMs: 0 },
    { id: "critic", title: "Критик", content: "🔍 Откройте http://localhost:5173 в браузере (не Electron).", model: "demo", durationMs: 0 },
    { id: "pragmatist", title: "Практик", content: "⚡ Войдите через Google, чтобы задавать вопросы.", model: "demo", durationMs: 0 },
    { id: "explainer", title: "Объяснитель", content: "📖 Или установите десктопное приложение.", model: "demo", durationMs: 0 }
  ];
}

let backendAvailable: boolean | null = null;

async function ensureBackendCheck(): Promise<boolean> {
  // Кэшируем только true — при false всегда перепроверяем (backend мог запуститься позже)
  if (backendAvailable === true) return true;
  backendAvailable = await webCheckBackend();
  return backendAvailable;
}

export function isWebMode(): boolean {
  return (window as unknown as { __THINKNEST_WEB_MODE__?: boolean }).__THINKNEST_WEB_MODE__ === true;
}

export function createWebApi() {
  return {
    async ask(
      payload: AskRequest,
      onAnswer?: (answer: AgentAnswer) => void,
      _onToken?: (agentId: string, token: string) => void
    ): Promise<AskResponse> {
      if (await ensureBackendCheck()) {
        try {
          return await webAsk(payload, onAnswer);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("401") || msg.includes("Unauthorized")) {
            const demoAnswers = getDemoAnswers().slice(0, 2);
            for (const a of demoAnswers) onAnswer?.(a);
            return {
              answers: demoAnswers,
              final: {
                content: "Войдите через Google, чтобы задавать вопросы.",
                model: "demo",
                durationMs: 0
              },
              webSources: null
            };
          }
          throw e;
        }
      }
      const demoAnswers = getDemoAnswers().slice(0, DEMO_ENTITLEMENTS.maxAgents);
      for (const a of demoAnswers) {
        await new Promise((r) => setTimeout(r, 300));
        onAnswer?.(a);
      }
      return {
        answers: demoAnswers,
        final: {
          content: isProductionHost()
            ? "Сервис временно недоступен. Попробуйте позже."
            : "Backend недоступен. Запустите backend и frontend, перезагрузите страницу.",
          model: "demo",
          durationMs: 0
        },
        webSources: null
      };
    },
    async getSession(): Promise<SessionState> {
      if (await ensureBackendCheck()) {
        return webGetSession();
      }
      return { token: null, user: null };
    },
    async loginWithGoogle(): Promise<SessionState> {
      if (await ensureBackendCheck()) {
        await webLoginWithGoogle();
        return { token: null, user: null };
      }
      return { token: null, user: null };
    },
    async logout(): Promise<{ ok: true }> {
      if (await ensureBackendCheck()) await webLogout();
      return { ok: true };
    },
    async getEntitlements(): Promise<Entitlements> {
      if (await ensureBackendCheck()) {
        try {
          return await webGetEntitlements();
        } catch {
          return DEMO_ENTITLEMENTS;
        }
      }
      return DEMO_ENTITLEMENTS;
    },
    async canAsk(): Promise<CanAskResponse> {
      if (await ensureBackendCheck()) {
        try {
          return await webCanAsk();
        } catch {
          return { allowed: true, reason: null, entitlements: DEMO_ENTITLEMENTS };
        }
      }
      return { allowed: true, reason: null, entitlements: DEMO_ENTITLEMENTS };
    },
    async consumeUsage(question: string): Promise<ConsumeUsageResponse> {
      if (await ensureBackendCheck()) {
        try {
          return await webConsumeUsage(question);
        } catch {
          return { entitlements: DEMO_ENTITLEMENTS };
        }
      }
      return { entitlements: DEMO_ENTITLEMENTS };
    },
    async openCheckout(_plan?: "weekly" | "monthly" | "yearly"): Promise<{ ok: true }> {
      return { ok: true };
    },
    async getSubscription(): Promise<{
      active: boolean;
      plan: string | null;
      interval: string | null;
      currentPeriodEnd: string | null;
      cancelAtPeriodEnd: boolean;
    }> {
      return { active: false, plan: null, interval: null, currentPeriodEnd: null, cancelAtPeriodEnd: false };
    },
    async openPortal(): Promise<{ ok: true }> {
      return { ok: true };
    },
    async openExternal(url: string): Promise<void> {
      window.open(url, "_blank");
    },
    async isDevMode(): Promise<boolean> {
      return false;
    },
    async setAskLocale(_locale: string): Promise<void> {},
    async stopAsk(): Promise<void> {},
    async checkOllama(): Promise<{ installed: boolean; running: boolean; models: string[] }> {
      return { installed: false, running: false, models: [] };
    },
    async startOllama(): Promise<void> {},
    async saveOnboardingProfile(_profile: string): Promise<{ ok: boolean }> {
      return { ok: true };
    },
    async pullModel(_model: string, _onProgress: (p: unknown) => void): Promise<{ ok: boolean }> {
      return { ok: true };
    },
    async exportMarkdown(_content: string, _filename: string): Promise<void> {},
    async exportPdf(_html: string, _filename: string): Promise<void> {},
    onStreamToken(_handler: (token: string, agentId: string) => void): () => void {
      return () => {};
    }
  };
}

/** Вызвать при загрузке — завершает OAuth redirect */
export function handleWebAuthRedirect(): boolean {
  return webCompleteAuth();
}
