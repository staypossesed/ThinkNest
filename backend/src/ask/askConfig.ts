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
    planner: "llama3.1:8b",
    critic: "qwen2.5:7b",
    pragmatist: "qwen2.5:7b",
    explainer: "llama3.1:8b",
    aggregator: "llama3.1:8b",
    imageFast: "llama3.1:8b",
    deepResearch: "llama3.1:8b",
    vision: "llava"
  },
  balanced: {
    planner: "llama3.1:8b",
    critic: "qwen2.5:7b",
    pragmatist: "qwen2.5:7b",
    explainer: "llama3.1:8b",
    aggregator: "llama3.1:8b",
    imageFast: "llama3.1:8b",
    deepResearch: "llama3.1:8b",
    vision: "llava"
  },
  quality: {
    planner: "llama3.1:8b",
    critic: "qwen2.5:7b",
    pragmatist: "qwen2.5:7b",
    explainer: "llama3.1:8b",
    aggregator: "llama3.1:8b",
    imageFast: "llama3.1:8b",
    deepResearch: "llama3.1:8b",
    vision: "llava"
  }
};

export function getModelsForMode(mode: OllamaMode = "balanced") {
  return MODE_MODELS[mode] ?? MODE_MODELS.balanced;
}

/** 7B/8B модели на CPU требуют больше времени. 25 сек было недостаточно — таймаут. */
const SIMPLE_TIMEOUT_MS = 50000;

export const ollamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 60000),
  simpleTimeoutMs: Number(process.env.OLLAMA_SIMPLE_TIMEOUT_MS ?? SIMPLE_TIMEOUT_MS),
  visionTimeoutMs: Number(process.env.OLLAMA_VISION_TIMEOUT_MS ?? 45000),
  agentConcurrency: Math.max(1, Number(process.env.OLLAMA_AGENT_CONCURRENCY ?? 2)),
  skipVisionIfOcr: (process.env.OLLAMA_SKIP_VISION_IF_OCR ?? "true") !== "false",
  llmLanguageRewrite: process.env.OLLAMA_LLM_LANGUAGE_REWRITE === "true",
  deepResearchModel: process.env.OLLAMA_DEEP_RESEARCH_MODEL ?? "llama3.1:8b",
  deepResearchTimeoutMs: Number(process.env.OLLAMA_DEEP_RESEARCH_TIMEOUT_MS ?? 150000),
  sequentialAgents: process.env.SEQUENTIAL_AGENTS === "true",
  visionModel: process.env.OLLAMA_VISION_MODEL ?? "llava"
};
