export type AgentId = "planner" | "critic" | "pragmatist" | "explainer";

export interface AskRequest {
  question: string;
  maxAgents?: number;
  /** Use web search for fresh data */
  useWebData?: boolean;
  /** Forecast mode: scenarios + confidence */
  forecastMode?: boolean;
  /** Deep research mode: broader evidence and deeper reasoning */
  deepResearchMode?: boolean;
  /** Язык ответа: ru | en | zh (ручной выбор или из профиля) */
  preferredLocale?: "ru" | "en" | "zh";
  /** Base64 data URIs (data:image/png;base64,...) для распознавания картинок */
  images?: string[];
}

export interface WebSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface AskResponseSources {
  query: string;
  results: WebSource[];
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
  /** Present when useWebData=true */
  webSources?: AskResponseSources;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  /** Язык из Google-аккаунта, напр. "ru", "en" */
  locale?: string;
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

/** Один обмен в чате: вопрос пользователя + ответ агентов */
export interface ConversationMessage {
  id: string;
  question: string;
  timestamp: number;
  answers: AgentAnswer[];
  final: AskResponse["final"] | null;
  webSources?: AskResponseSources | null;
  useWebData?: boolean;
  forecastMode?: boolean;
  deepResearchMode?: boolean;
  /** Base64 data URIs для отображения прикреплённых картинок */
  images?: string[];
}

/** Чат — список сообщений */
export interface Conversation {
  id: string;
  messages: ConversationMessage[];
  createdAt: number;
  updatedAt: number;
}
