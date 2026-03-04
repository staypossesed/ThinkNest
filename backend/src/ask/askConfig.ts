export type OllamaMode = "fast" | "balanced" | "quality";

export const MODE_MODELS: Record<
  OllamaMode,
  {
    planner: string;
    critic: string;
    pragmatist: string;
    explainer: string;
    aggregator: string;
    imageFast: string;
    deepResearch: string;
    vision: string;
  }
> = {
  fast: {
    planner: "phi3",
    critic: "phi3",
    pragmatist: "phi3",
    explainer: "phi3",
    aggregator: "phi3",
    imageFast: "phi3",
    deepResearch: "mistral",
    vision: "llava"
  },
  balanced: {
    planner: "mistral",
    critic: "mistral",
    pragmatist: "mistral",
    explainer: "phi3",
    aggregator: "mistral",
    imageFast: "phi3",
    deepResearch: "llama3.1",
    vision: "llava"
  },
  quality: {
    planner: "llama3.1",
    critic: "llama3.1",
    pragmatist: "mistral",
    explainer: "phi3",
    aggregator: "llama3.1",
    imageFast: "phi3",
    deepResearch: "llama3.1",
    vision: "llava"
  }
};

export function getModelsForMode(mode: OllamaMode = "balanced") {
  return MODE_MODELS[mode] ?? MODE_MODELS.balanced;
}

const SIMPLE_TIMEOUT_MS = 25000;

export const ollamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 90000),
  simpleTimeoutMs: Number(process.env.OLLAMA_SIMPLE_TIMEOUT_MS ?? SIMPLE_TIMEOUT_MS),
  visionTimeoutMs: Number(process.env.OLLAMA_VISION_TIMEOUT_MS ?? 45000),
  agentConcurrency: Math.max(1, Number(process.env.OLLAMA_AGENT_CONCURRENCY ?? 2)),
  skipVisionIfOcr: (process.env.OLLAMA_SKIP_VISION_IF_OCR ?? "true") !== "false",
  llmLanguageRewrite: process.env.OLLAMA_LLM_LANGUAGE_REWRITE === "true",
  deepResearchModel: process.env.OLLAMA_DEEP_RESEARCH_MODEL ?? "llama3.1",
  deepResearchTimeoutMs: Number(process.env.OLLAMA_DEEP_RESEARCH_TIMEOUT_MS ?? 150000),
  sequentialAgents: process.env.SEQUENTIAL_AGENTS === "true",
  visionModel: process.env.OLLAMA_VISION_MODEL ?? "llava"
};
