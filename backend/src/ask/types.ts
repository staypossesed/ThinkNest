export type AgentId = "planner" | "critic" | "pragmatist" | "explainer";

export type OllamaMode = "fast" | "balanced" | "quality";

export interface AskRequest {
  question: string;
  maxAgents?: number;
  mode?: OllamaMode;
  useWebData?: boolean;
  forecastMode?: boolean;
  deepResearchMode?: boolean;
  debateMode?: boolean;
  preferredLocale?: "ru" | "en" | "zh";
  images?: string[];
  expertProfile?: string;
  memoryContext?: string;
  /** Previous Q&A in this chat for follow-up context */
  chatHistory?: Array<{ question: string; answer: string }>;
}

export interface WebSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface AgentAnswer {
  id: AgentId;
  title: string;
  content: string;
  model: string;
  durationMs: number;
}

/** Called when each agent answers (for live display) */
export type OnAgentAnswer = (answer: AgentAnswer) => void;

export interface AskResponse {
  answers: AgentAnswer[];
  final: {
    content: string;
    model: string;
    durationMs: number;
  };
  webSources?: { query: string; results: WebSource[] };
}
