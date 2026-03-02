/** Web search results for agents (DuckDuckGo, no API key) */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const MAX_RESULTS_PER_QUERY = 5;
const MAX_TOTAL = 12;
const SNIPPET_LEN = 500;

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

/** Search using multiple queries, deduplicate by URL */
export async function searchWeb(queries: string[]): Promise<WebSearchResult[]> {
  if (queries.length === 0) return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ddg = require("duckduckgo-search") as {
      text: (q: string) => AsyncIterable<{ title: string; href: string; body: string }>;
    };
    const seen = new Set<string>();
    const all: WebSearchResult[] = [];
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
  return (
    "Ключевые данные из поиска (используй в первую очередь). При противоречиях между источниками — укажи разные версии:\n" +
    lines.join("\n\n")
  );
}
