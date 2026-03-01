export type AgentId = "planner" | "critic" | "pragmatist" | "explainer";

export interface AskRequest {
  question: string;
  maxAgents?: number;
}

/** Вызывается при каждом ответе агента (для live-отображения) */
export type OnAgentAnswer = (answer: AgentAnswer) => void;

export interface AgentAnswer {
  id: AgentId;
  title: string;
  content: string;
  model: string;
  durationMs: number;
}

export interface AskResponse {
  answers: AgentAnswer[];
  final: {
    content: string;
    model: string;
    durationMs: number;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}

export interface Entitlements {
  plan: "free" | "pro";
  maxAgents: number;
  periodType: "daily" | "monthly";
  maxQuestions: number;
  usedQuestions: number;
  remainingQuestions: number;
}

export interface CanAskResponse {
  allowed: boolean;
  reason: string | null;
  entitlements: Entitlements;
}

export interface ConsumeUsageResponse {
  ok: boolean;
  reason?: string;
  entitlements: Entitlements;
}

export interface SessionState {
  token: string | null;
  user: UserProfile | null;
}
