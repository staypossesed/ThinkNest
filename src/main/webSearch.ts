/** Web search results for agents (DuckDuckGo, no API key) */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const MAX_RESULTS_PER_QUERY = 5;
const MAX_TOTAL = 12;
const SNIPPET_LEN = 400;

async function searchSingle(
  ddg: { text: (q: string) => AsyncIterable<{ title: string; href: string; body: string }> },
  query: string
): Promise<WebSearchResult[]> {
  const results: WebSearchResult[] = [];
  let count = 0;
  for await (const r of ddg.text(query)) {
    if (count >= MAX_RESULTS_PER_QUERY) break;
    results.push({ title: r.title || "", url: r.href || "", snippet: r.body || "" });
    count++;
  }
  return results;
}

/** Deep Research: multiple queries for better coverage */
export async function searchWeb(question: string): Promise<WebSearchResult[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ddg = require("duckduckgo-search") as {
      text: (q: string) => AsyncIterable<{ title: string; href: string; body: string }>;
    };
    const seen = new Set<string>();
    const all: WebSearchResult[] = [];
    const queries = [question];
    const short = question.replace(/\s+/g, " ").slice(0, 80);
    if (short !== question) queries.push(short);
    const words = question.split(/\s+/).filter((w) => w.length > 2).slice(0, 4);
    if (words.length >= 2) queries.push(words.join(" "));
    if (/\b(картошк|картофел)\b/i.test(question) && /\b(росси|рф)\b/i.test(question)) {
      queries.push("Петр I картофель Россия");
    }
    if (/\b(кто|когда|зачем)\s+(привёз|завёз|привез|завез)/i.test(question) && /\b(росси|рф)\b/i.test(question)) {
      const topic = question.replace(/\b(кто|когда|зачем|привёз|завёз|привез|завез|в|россию|рф)\b/gi, "").trim().slice(0, 30);
      if (topic) queries.push(`${topic} Россия история`);
    }
    for (const q of queries) {
      if (all.length >= MAX_TOTAL) break;
      const batch = await searchSingle(ddg, q);
      for (const r of batch) {
        if (seen.has(r.url) || all.length >= MAX_TOTAL) continue;
        seen.add(r.url);
        all.push(r);
      }
    }
    return all;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn("[webSearch] DuckDuckGo failed:", msg);
    return [];
  }
}

export function formatWebContext(results: WebSearchResult[]): string {
  if (results.length === 0) return "";
  const lines = results.map((r, i) => {
    const snip = (r.snippet || "").slice(0, SNIPPET_LEN);
    return `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${snip}`;
  });
  return "Данные из веба (ОБЯЗАТЕЛЬНО используй при ответе, не выдумывай факты):\n" + lines.join("\n\n");
}
