export const ollamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  /** Таймаут на агента — 60 сек. Быстрые модели не должны зависать. */
  timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 60000),
  /** Таймаут для vision (llava) — 45 сек, чтобы не подвисать надолго. */
  visionTimeoutMs: Number(process.env.OLLAMA_VISION_TIMEOUT_MS ?? 45000),
  /** Ограничение параллелизма агентов (на CPU 2 обычно быстрее, чем 4). */
  agentConcurrency: Math.max(1, Number(process.env.OLLAMA_AGENT_CONCURRENCY ?? 2)),
  /** Пропускать vision, если OCR уже извлёк текст. */
  skipVisionIfOcr: (process.env.OLLAMA_SKIP_VISION_IF_OCR ?? "true") !== "false",
  /** Дорогой LLM-rewrite языка выключен по умолчанию для скорости. */
  llmLanguageRewrite: process.env.OLLAMA_LLM_LANGUAGE_REWRITE === "true",
  /** Профиль для Deep Research: сильнее модель, дольше таймаут. */
  deepResearchModel: process.env.OLLAMA_DEEP_RESEARCH_MODEL ?? "llama3.1",
  deepResearchTimeoutMs: Number(process.env.OLLAMA_DEEP_RESEARCH_TIMEOUT_MS ?? 150000),
  /** Параллельный запуск по умолчанию — быстрее (max вместо sum). SEQUENTIAL_AGENTS=true для последовательного. */
  sequentialAgents: process.env.SEQUENTIAL_AGENTS === "true",
  /** Смешанный профиль по умолчанию: баланс качества и скорости. */
  agents: {
    planner: process.env.OLLAMA_PLANNER_MODEL ?? "mistral",
    critic: process.env.OLLAMA_CRITIC_MODEL ?? "llama3.1",
    pragmatist: process.env.OLLAMA_PRAGMATIST_MODEL ?? "mistral",
    explainer: process.env.OLLAMA_EXPLAINER_MODEL ?? "phi3"
  },
  aggregatorModel: process.env.OLLAMA_AGGREGATOR_MODEL ?? "llama3.1",
  /** Быстрый профиль для image-only/vision сценариев. */
  imageFastModel: process.env.OLLAMA_IMAGE_FAST_MODEL ?? "phi3",
  /** Vision model для распознавания картинок (llava, llava:7b и т.п.) */
  visionModel: process.env.OLLAMA_VISION_MODEL ?? "llava"
};
