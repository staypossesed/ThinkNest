export type OllamaMode = "fast" | "balanced" | "quality";

/** Модели для каждого режима — пользователь выбирает только режим, модели устанавливаются автоматически */
export const MODE_MODELS: Record<OllamaMode, {
  planner: string;
  critic: string;
  pragmatist: string;
  explainer: string;
  aggregator: string;
  imageFast: string;
  deepResearch: string;
  vision: string;
}> = {
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

/** Все модели, которые устанавливаются при онбординге — фиксированный набор */
export const REQUIRED_MODELS = ["llama3.2:3b", "qwen2.5:3b", "deepseek-r1:7b", "llava"] as const;

export function getModelsForMode(mode: OllamaMode = "balanced") {
  return MODE_MODELS[mode] ?? MODE_MODELS.balanced;
}

const SIMPLE_TIMEOUT_MS = 25000;

export const ollamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  /** Таймаут на агента — 60 сек. Быстрые модели не должны зависать. */
  timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 60000),
  /** Таймаут для простых вопросов (phi3). */
  simpleTimeoutMs: Number(process.env.OLLAMA_SIMPLE_TIMEOUT_MS ?? SIMPLE_TIMEOUT_MS),
  /** Таймаут для vision (llava) — 45 сек, чтобы не подвисать надолго. */
  visionTimeoutMs: Number(process.env.OLLAMA_VISION_TIMEOUT_MS ?? 45000),
  /** Ограничение параллелизма агентов (на CPU 2 обычно быстрее, чем 4). */
  agentConcurrency: Math.max(1, Number(process.env.OLLAMA_AGENT_CONCURRENCY ?? 2)),
  /** Пропускать vision, если OCR уже извлёк текст. */
  skipVisionIfOcr: (process.env.OLLAMA_SKIP_VISION_IF_OCR ?? "true") !== "false",
  /** Дорогой LLM-rewrite языка выключен по умолчанию для скорости. */
  llmLanguageRewrite: process.env.OLLAMA_LLM_LANGUAGE_REWRITE === "true",
  /** Профиль для Deep Research: сильнее модель, дольше таймаут. */
  deepResearchModel: process.env.OLLAMA_DEEP_RESEARCH_MODEL ?? "llama3.2:3b",
  deepResearchTimeoutMs: Number(process.env.OLLAMA_DEEP_RESEARCH_TIMEOUT_MS ?? 150000),
  /** Параллельный запуск по умолчанию — быстрее (max вместо sum). SEQUENTIAL_AGENTS=true для последовательного. */
  sequentialAgents: process.env.SEQUENTIAL_AGENTS === "true",
  /** Смешанный профиль по умолчанию: баланс качества и скорости. */
  agents: {
    planner: process.env.OLLAMA_PLANNER_MODEL ?? "llama3.2:3b",
    critic: process.env.OLLAMA_CRITIC_MODEL ?? "qwen2.5:3b",
    pragmatist: process.env.OLLAMA_PRAGMATIST_MODEL ?? "deepseek-r1:7b",
    explainer: process.env.OLLAMA_EXPLAINER_MODEL ?? "llama3.2:3b"
  },
  aggregatorModel: process.env.OLLAMA_AGGREGATOR_MODEL ?? "llama3.2:3b",
  /** Быстрый профиль для image-only/vision сценариев. */
  imageFastModel: process.env.OLLAMA_IMAGE_FAST_MODEL ?? "llama3.2:3b",
  /** Vision model для распознавания картинок (llava, llava:7b и т.п.) */
  visionModel: process.env.OLLAMA_VISION_MODEL ?? "llava"
};
