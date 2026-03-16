import type {
  AgentAnswer,
  AskRequest,
  AskResponse,
  CanAskResponse,
  ConsumeUsageResponse,
  Entitlements,
  SessionState
} from "../shared/types";

interface OllamaStatus {
  installed: boolean;
  running: boolean;
  models: string[];
}

interface PullProgress {
  model: string;
  status: string;
  percent: number;
  done: boolean;
  error?: string;
}

declare global {
  interface Window {
    api: {
      ask: (
        payload: AskRequest,
        onAnswer?: (answer: AgentAnswer) => void,
        onToken?: (agentId: string, token: string) => void
      ) => Promise<AskResponse>;
      getSession: () => Promise<SessionState>;
      loginWithGoogle: () => Promise<SessionState>;
      logout: () => Promise<{ ok: true }>;
      getEntitlements: () => Promise<Entitlements>;
      canAsk: (deepResearchMode?: boolean) => Promise<CanAskResponse>;
      consumeUsage: (question: string, count?: number) => Promise<ConsumeUsageResponse>;
      openCheckout: (plan?: "weekly" | "monthly" | "yearly") => Promise<{ ok: true }>;
      getSubscription: () => Promise<{
        active: boolean;
        plan: string | null;
        interval: string | null;
        currentPeriodEnd: string | null;
        cancelAtPeriodEnd: boolean;
      }>;
      openPortal: () => Promise<{ ok: true }>;
      openExternal: (url: string) => Promise<void>;
      isDevMode: () => Promise<boolean>;
      setAskLocale: (locale: string) => Promise<void>;
      stopAsk: () => Promise<void>;
      checkOllama: () => Promise<OllamaStatus>;
      startOllama: () => Promise<void>;
      saveOnboardingProfile: (profile: string) => Promise<{ ok: boolean }>;
      pullModel: (model: string, onProgress: (p: PullProgress) => void) => Promise<{ ok: boolean }>;
      exportMarkdown: (content: string, filename: string) => Promise<void>;
      exportPdf: (html: string, filename: string) => Promise<void>;
      onStreamToken: (handler: (token: string, agentId: string) => void) => () => void;
    };
  }
}

export {};
