import { chatCompletion } from "./ollama";
import { ollamaConfig } from "./config";

const QUERY_MODEL = "phi3";
const QUERY_TIMEOUT_MS = 10000;

/**
 * Generate 2-3 search queries from any question (universal, no hardcoding).
 * Fallback returns empty array — caller uses question/short/words.
 */
export async function generateSearchQueries(question: string): Promise<string[]> {
  try {
    const response = await chatCompletion({
      baseUrl: ollamaConfig.baseUrl,
      model: QUERY_MODEL,
      timeoutMs: QUERY_TIMEOUT_MS,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Ты помощник. Из вопроса пользователя выдели 2-3 коротких поисковых запроса (3-6 слов каждый) для поиска ответа в интернете. " +
            "Ответь ТОЛЬКО запросами через запятую, без нумерации и пояснений."
        },
        { role: "user", content: question }
      ]
    });
    const raw = (response || "").trim();
    if (!raw) return [];
    const queries = raw
      .split(/[,;]/)
      .map((q) => q.trim().replace(/\s+/g, " ").slice(0, 50))
      .filter((q) => q.length >= 3);
    const seen = new Set<string>();
    return queries.filter((q) => {
      const key = q.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (err) {
    console.warn("[queryGenerator] LLM failed:", err instanceof Error ? err.message : "unknown");
    return [];
  }
}

/** Fallback queries when LLM fails */
export function getFallbackQueries(question: string): string[] {
  const queries: string[] = [question];
  const short = question.replace(/\s+/g, " ").slice(0, 80);
  if (short !== question) queries.push(short);
  const words = question.split(/\s+/).filter((w) => w.length > 2).slice(0, 4);
  if (words.length >= 2) queries.push(words.join(" "));
  return queries;
}
