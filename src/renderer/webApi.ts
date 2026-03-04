/**
 * Web API adapter — заглушки для работы в браузере без Electron.
 * Позволяет просматривать интерфейс на телефоне (PWA).
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

const DEMO_ANSWERS: AgentAnswer[] = [
  { id: "planner", title: "Планировщик", content: "📋 В веб-режиме можно только просматривать интерфейс. Для полной работы установите десктопное приложение.", model: "demo", durationMs: 0 },
  { id: "critic", title: "Критик", content: "🔍 Это демо-режим. Реальные ответы доступны в Electron-приложении с Ollama.", model: "demo", durationMs: 0 },
  { id: "pragmatist", title: "Практик", content: "⚡ Откройте приложение на компьютере, чтобы задавать вопросы и получать ответы от агентов.", model: "demo", durationMs: 0 },
  { id: "explainer", title: "Объяснитель", content: "📖 PWA-версия — для тестирования интерфейса на телефоне. Полный функционал — в десктопе.", model: "demo", durationMs: 0 }
];

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
      // Имитация потоковой выдачи
      const demoAnswers = DEMO_ANSWERS.slice(0, DEMO_ENTITLEMENTS.maxAgents);
      for (const a of demoAnswers) {
        await new Promise((r) => setTimeout(r, 300));
        onAnswer?.(a);
      }
      return {
        answers: demoAnswers,
        final: {
          content: "Это демо-режим. Для реальных ответов установите десктопное приложение и запустите Ollama.",
          model: "demo",
          durationMs: 0
        },
        webSources: null
      };
    },
    async getSession(): Promise<SessionState> {
      return { token: "web-demo", user: { email: "demo@web", fullName: "Web Demo", locale: "ru" } };
    },
    async loginWithGoogle(): Promise<SessionState> {
      return { token: "web-demo", user: { email: "demo@web", fullName: "Web Demo", locale: "ru" } };
    },
    async logout(): Promise<{ ok: true }> {
      return { ok: true };
    },
    async getEntitlements(): Promise<Entitlements> {
      return DEMO_ENTITLEMENTS;
    },
    async canAsk(): Promise<CanAskResponse> {
      return { allowed: true, reason: null, entitlements: DEMO_ENTITLEMENTS };
    },
    async consumeUsage(_question: string): Promise<ConsumeUsageResponse> {
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
      return true;
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
