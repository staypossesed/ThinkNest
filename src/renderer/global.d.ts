import type {
  AgentAnswer,
  AskRequest,
  AskResponse,
  CanAskResponse,
  ConsumeUsageResponse,
  Entitlements,
  SessionState
} from "../shared/types";

declare global {
  interface Window {
    api: {
      ask: (
        payload: AskRequest,
        onAnswer?: (answer: AgentAnswer) => void
      ) => Promise<AskResponse>;
      getSession: () => Promise<SessionState>;
      loginWithGoogle: () => Promise<SessionState>;
      logout: () => Promise<{ ok: true }>;
      getEntitlements: () => Promise<Entitlements>;
      canAsk: () => Promise<CanAskResponse>;
      consumeUsage: (question: string) => Promise<ConsumeUsageResponse>;
      openCheckout: () => Promise<{ ok: true }>;
      openPortal: () => Promise<{ ok: true }>;
      openExternal: (url: string) => Promise<void>;
      isDevMode: () => Promise<boolean>;
    };
  }
}

export {};
