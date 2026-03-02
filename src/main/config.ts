export const ollamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  /** Таймаут на агента — 120 сек (mistral может быть медленным) */
  timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 120000),
  /** Параллельный запуск по умолчанию — быстрее (max вместо sum). SEQUENTIAL_AGENTS=true для последовательного. */
  sequentialAgents: process.env.SEQUENTIAL_AGENTS === "true",
  /** Модели для 4 агентов — разные, чтобы ответы отличались */
  /** Модели — разные для 4 точек зрения */
  agents: {
    planner: "mistral",
    critic: "llama3.1",
    pragmatist: "qwen2.5",
    explainer: "phi3"
  },
  aggregatorModel: "llama3.1"
};
