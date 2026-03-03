export type AgentId = "planner" | "critic" | "pragmatist" | "explainer";

/** Режим работы: быстрый / сбалансированный / качественный — влияет на выбор моделей */
export type OllamaMode = "fast" | "balanced" | "quality";

export interface AskRequest {
  question: string;
  maxAgents?: number;
  /** Режим: fast | balanced | quality — выбор моделей (из онбординга) */
  mode?: OllamaMode;
  /** Use web search for fresh data */
  useWebData?: boolean;
  /** Forecast mode: scenarios + confidence */
  forecastMode?: boolean;
  /** Deep research mode: broader evidence and deeper reasoning */
  deepResearchMode?: boolean;
  /** Debate mode: agents challenge each other */
  debateMode?: boolean;
  /** Язык ответа: ru | en | zh (ручной выбор или из профиля) */
  preferredLocale?: "ru" | "en" | "zh";
  /** Base64 data URIs (data:image/png;base64,...) для распознавания картинок */
  images?: string[];
  /** Expert profile: lawyer, doctor, investor, developer, etc. */
  expertProfile?: string;
  /** User memory context injected into each agent prompt */
  memoryContext?: string;
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
  /** Pro-only feature flags (default true for backward compat) */
  allowWebData?: boolean;
  allowForecast?: boolean;
  allowDebate?: boolean;
  allowExpertProfile?: boolean;
  allowMemory?: boolean;
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
  debateMode?: boolean;
  expertProfile?: string;
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
