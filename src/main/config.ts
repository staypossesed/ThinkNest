export const ollamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  /** Таймаут на агента — 120 сек (mistral может быть медленным) */
  timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 120000),
  /** Последовательный запуск агентов — надёжнее (Ollama не перегружается). SEQUENTIAL_AGENTS=false для параллельного. */
  sequentialAgents: process.env.SEQUENTIAL_AGENTS !== "false",
  /** Модели для 4 агентов — разные, чтобы ответы отличались */
  /** Модели — разные для 4 точек зрения */
  agents: {
    planner: "llama3.1",
    critic: "mistral",
    pragmatist: "qwen2.5",
    explainer: "phi3"
  },
  aggregatorModel: "llama3.1"
};
