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
    planner: "llama3.2:3b",
    critic: "qwen2.5:3b",
    pragmatist: "deepseek-r1:7b",
    explainer: "llama3.2:3b",
    aggregator: "llama3.2:3b",
    imageFast: "llama3.2:3b",
    deepResearch: "llama3.2:3b",
    vision: "llava"
  },
  balanced: {
    planner: "llama3.2:3b",
    critic: "qwen2.5:3b",
    pragmatist: "deepseek-r1:7b",
    explainer: "llama3.2:3b",
    aggregator: "llama3.2:3b",
    imageFast: "llama3.2:3b",
    deepResearch: "llama3.2:3b",
    vision: "llava"
  },
  quality: {
    planner: "llama3.2:3b",
    critic: "qwen2.5:3b",
    pragmatist: "deepseek-r1:7b",
    explainer: "llama3.2:3b",
    aggregator: "llama3.2:3b",
    imageFast: "llama3.2:3b",
    deepResearch: "llama3.2:3b",
    vision: "llava"
  }
};

export function getModelsForMode(mode: OllamaMode = "balanced") {
  return MODE_MODELS[mode] ?? MODE_MODELS.balanced;
}

const SIMPLE_TIMEOUT_MS = 25000;

export const ollamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 60000),
  simpleTimeoutMs: Number(process.env.OLLAMA_SIMPLE_TIMEOUT_MS ?? SIMPLE_TIMEOUT_MS),
  visionTimeoutMs: Number(process.env.OLLAMA_VISION_TIMEOUT_MS ?? 45000),
  agentConcurrency: Math.max(1, Number(process.env.OLLAMA_AGENT_CONCURRENCY ?? 2)),
  skipVisionIfOcr: (process.env.OLLAMA_SKIP_VISION_IF_OCR ?? "true") !== "false",
  llmLanguageRewrite: process.env.OLLAMA_LLM_LANGUAGE_REWRITE === "true",
  deepResearchModel: process.env.OLLAMA_DEEP_RESEARCH_MODEL ?? "llama3.2:3b",
  deepResearchTimeoutMs: Number(process.env.OLLAMA_DEEP_RESEARCH_TIMEOUT_MS ?? 150000),
  sequentialAgents: process.env.SEQUENTIAL_AGENTS === "true",
  visionModel: process.env.OLLAMA_VISION_MODEL ?? "llava"
};
