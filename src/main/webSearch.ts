/** Web search results for agents (DuckDuckGo, no API key) */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const MAX_RESULTS = 8;

export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ddg = require("duckduckgo-search") as {
      text: (
        keywords: string
      ) => AsyncIterable<{ title: string; href: string; body: string }>;
    };
    const results: WebSearchResult[] = [];
    let count = 0;
    for await (const r of ddg.text(query)) {
      if (count >= MAX_RESULTS) break;
      results.push({
        title: r.title || "",
        url: r.href || "",
        snippet: r.body || ""
      });
      count++;
    }
    return results;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.warn("[webSearch] DuckDuckGo failed:", msg);
    return [];
  }
}

export function formatWebContext(results: WebSearchResult[]): string {
  if (results.length === 0) return "";
  const lines = results.map((r, i) => {
    const snip = (r.snippet || "").slice(0, 300);
    return `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${snip}`;
  });
  return "Актуальные данные из веба:\n" + lines.join("\n\n");
}
