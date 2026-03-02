/** Web search results for agents (DuckDuckGo, no API key) */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

function _dbg(_loc: string, _msg: string, _data: Record<string, unknown>, _hid?: string): void {
  /* no-op */
}

const MAX_RESULTS_PER_QUERY = 5;
const MAX_TOTAL = 12;
const SNIPPET_LEN = 500;

/** MyMemory API — бесплатный перевод ru->en для улучшения Wikipedia поиска. */
async function translateToEnglish(text: string): Promise<string | null> {
  const q = text.trim().slice(0, 200);
  if (!q) return null;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=ru|en`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    const translated = json.responseData?.translatedText?.trim();
    return translated && translated !== q ? translated : null;
  } catch {
    return null;
  }
}

function normalizeQuery(input: string): string {
  return input
    .replace(/\[test\s*\d+\]/gi, " ")
    .replace(/\bща\b/gi, "сейчас")
    .replace(/\bщас\b/gi, "сейчас")
    .replace(/[^\p{L}\p{N}\s\-?]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

/** Дополнительные поисковые запросы для мульти-сущностей (биткоин и солана и т.д.). */
function getSupplementaryQueries(mainQuery: string): string[] {
  const lower = mainQuery.toLowerCase();
  const extra: string[] = [];
  if ((/биткоин|bitcoin|btc/i.test(lower) && /солана|solana|sol/i.test(lower)) ||
      (/эфир|ethereum|eth/i.test(lower) && /солана|solana|sol/i.test(lower))) {
    extra.push("Solana price SOL курс");
  }
  return extra;
}

/** Универсальный поиск: Google (SerpAPI/Serper) -> Wikipedia -> DDG. Один поток для любых запросов. */
export async function searchWeb(queries: string[]): Promise<WebSearchResult[]> {
  if (queries.length === 0) return [];
  const raw = normalizeQuery((queries[0] || "").trim());
  const supplementary = getSupplementaryQueries(raw);
  const allQueries = [raw, ...supplementary];
  // #region agent log
  _dbg("webSearch.ts:searchWeb:entry", "searchWeb called", { queriesCount: allQueries.length, raw, supplementary }, "H1");
  // #endregion

  const dedupe = (arr: WebSearchResult[]): WebSearchResult[] =>
    arr.filter((r, i, a) => {
      const url = (r.url || "").toLowerCase();
      return url && a.findIndex((x) => (x.url || "").toLowerCase() === url) === i;
    });

  // 1) Google — основной + доп. запросы для мульти-сущностей (биткоин и солана)
  let results: WebSearchResult[] = [];
  for (const q of allQueries) {
    const part = await searchGoogle([q]);
    results = dedupe([...results, ...part]);
  }
  if (results.length > 0) return results.slice(0, MAX_TOTAL);

  // 2) Wikipedia
  let wikiResults = await searchWikipediaFallback([raw]);
  if (wikiResults.length === 0 && /[\u0400-\u04FF]/.test(raw)) {
    const enQuery = await translateToEnglish(raw);
    if (enQuery) wikiResults = await searchWikipediaFallback([enQuery]);
  }
  for (const q of supplementary) {
    const extra = await searchWikipediaFallback([q]);
    wikiResults = dedupe([...wikiResults, ...extra]);
  }
  if (wikiResults.length > 0) return wikiResults.slice(0, MAX_TOTAL);

  // 3) DuckDuckGo
  let ddgResults = await searchDuckDuckGoInstantFallback([raw], false);
  for (const q of supplementary) {
    const extra = await searchDuckDuckGoInstantFallback([q], false);
    ddgResults = dedupe([...ddgResults, ...extra]);
  }
  if (ddgResults.length > 0) return ddgResults.slice(0, MAX_TOTAL);

  return [];
}

/** Google Search: SerpAPI (SERPAPI_KEY) или Serper (SERPER_API_KEY, 2500 бесплатно/мес). */
async function searchGoogle(queries: string[]): Promise<WebSearchResult[]> {
  const q = (queries[0] || "").trim().slice(0, 160);
  if (!q) return [];

  const serpKey = (process.env.SERPAPI_KEY || "").trim();
  if (serpKey) {
    const out = await searchGoogleSerpApi(q, serpKey);
    if (out.length > 0) return out;
  }

  const serperKey = (process.env.SERPER_API_KEY || "").trim();
  if (serperKey) {
    const out = await searchGoogleSerper(q, serperKey);
    if (out.length > 0) return out;
  }

  // #region agent log
  _dbg("webSearch.ts:google:skip", "no SERPAPI_KEY or SERPER_API_KEY", {}, "H16");
  // #endregion
  return [];
}

async function searchGoogleSerpApi(q: string, key: string): Promise<WebSearchResult[]> {
  try {
    const url = `https://serpapi.com/search.json?engine=google&num=10&q=${encodeURIComponent(q)}&api_key=${encodeURIComponent(key)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
    };
    return (json.organic_results || [])
      .slice(0, MAX_RESULTS_PER_QUERY)
      .map((r) => ({
        title: r.title || "",
        url: r.link || "",
        snippet: (r.snippet || "").trim()
      }))
      .filter((r) => r.url && r.title);
  } catch {
    return [];
  }
}

/** Serper.dev — 2500 бесплатных запросов/мес. https://serper.dev */
async function searchGoogleSerper(q: string, key: string): Promise<WebSearchResult[]> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q }),
      signal: AbortSignal.timeout(9000)
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
      knowledgeGraph?: { description?: string; title?: string };
    };
    const organic = (json.organic || []).slice(0, MAX_RESULTS_PER_QUERY);
    const out: WebSearchResult[] = organic
      .map((r) => ({
        title: r.title || "",
        url: r.link || "",
        snippet: (r.snippet || "").trim()
      }))
      .filter((r) => r.url && r.title);
    if (out.length === 0 && json.knowledgeGraph?.description) {
      out.push({
        title: json.knowledgeGraph.title || "Knowledge Graph",
        url: "https://www.google.com/search?q=" + encodeURIComponent(q),
        snippet: json.knowledgeGraph.description
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Fallback #1: DuckDuckGo Instant Answer API (no vqd). */
async function searchDuckDuckGoInstantFallback(
  queries: string[],
  allowWikipediaFallback = true
): Promise<WebSearchResult[]> {
  const raw = (queries[0] || "").trim();
  if (!raw) return [];
  try {
    const url =
      `https://api.duckduckgo.com/?q=${encodeURIComponent(raw)}` +
      "&format=json&no_html=1&skip_disambig=1";
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    // #region agent log
    _dbg("webSearch.ts:ddgInstantStatus", "ddg instant response status", { status: res.status }, "H14");
    // #endregion
    if (!res.ok) return allowWikipediaFallback ? searchWikipediaFallback(queries) : [];

    const json = (await res.json()) as {
      Heading?: string;
      AbstractText?: string;
      AbstractURL?: string;
      Results?: Array<{ Text?: string; FirstURL?: string }>;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
    };

    const out: WebSearchResult[] = [];
    if (json.AbstractText) {
      out.push({
        title: json.Heading || "DuckDuckGo Instant Answer",
        url: json.AbstractURL || "https://duckduckgo.com/",
        snippet: json.AbstractText.slice(0, 450)
      });
    }
    for (const r of json.Results || []) {
      if (!r.FirstURL || !r.Text) continue;
      out.push({ title: "DuckDuckGo Result", url: r.FirstURL, snippet: r.Text.slice(0, 450) });
      if (out.length >= 5) break;
    }
    if (out.length < 5) {
      for (const t of json.RelatedTopics || []) {
        if (!t.FirstURL || !t.Text) continue;
        out.push({ title: "DuckDuckGo Related", url: t.FirstURL, snippet: t.Text.slice(0, 450) });
        if (out.length >= 5) break;
      }
    }
    // #region agent log
    _dbg(
      "webSearch.ts:ddgInstantParsed",
      "ddg instant parsed",
      { results: out.length, hasTrump: /трамп|trump/i.test(JSON.stringify(out)) },
      "H15"
    );
    // #endregion
    if (out.length > 0) return out;
    return allowWikipediaFallback ? searchWikipediaFallback(queries) : [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // #region agent log
    _dbg("webSearch.ts:ddgInstantCatch", "ddg instant failed", { msg }, "H14");
    // #endregion
    return allowWikipediaFallback ? searchWikipediaFallback(queries) : [];
  }
}

/** Fallback #2: Wikipedia Search API — универсальный поиск по любому запросу. */
async function searchWikipediaFallback(queries: string[]): Promise<WebSearchResult[]> {
  const raw = normalizeQuery((queries[0] || "").trim().slice(0, 100));
  const wikiQuery = raw || "search";
  const q = encodeURIComponent(wikiQuery);
  // #region agent log
  _dbg("webSearch.ts:wikipediaFallback", "using Wikipedia", { raw, wikiQuery }, "H6");
  // #endregion
  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${q}` +
      "&format=json&utf8=1&srlimit=5";
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "ThinkNest/1.0 (local desktop app)" }
    });
    // #region agent log
    _dbg("webSearch.ts:wikipediaStatus", "wikipedia response status", { status: res.status }, "H11");
    // #endregion
    if (!res.ok) return [];
    const json = (await res.json()) as {
      query?: { search?: Array<{ title?: string; snippet?: string }> };
    };
    const pages = json.query?.search || [];
    // #region agent log
    _dbg(
      "webSearch.ts:wikipediaPages",
      "wikipedia pages parsed",
      {
        pagesCount: pages.length,
        firstTitle: pages[0]?.title || "",
        hasTrump: pages.some((p) => /трамп|trump/i.test((p.title || "") + " " + (p.snippet || ""))),
        hasBiden: pages.some((p) => /байден|biden/i.test((p.title || "") + " " + (p.snippet || "")))
      },
      "H12"
    );
    // #endregion
    return pages.slice(0, 5).map((p) => ({
      title: p.title || "",
      url: `https://en.wikipedia.org/wiki/${(p.title || "").replace(/ /g, "_")}`,
      snippet: (p.snippet || "").replace(/<[^>]+>/g, "").trim().slice(0, 400)
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // #region agent log
    _dbg("webSearch.ts:wikipediaCatch", "wikipedia fetch failed", { msg }, "H13");
    // #endregion
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
    "=== ИСТОЧНИКИ ИЗ ИНТЕРНЕТА (ТВОЙ ИСТОЧНИК ФАКТОВ) ===\n" +
    "Используй ТОЛЬКО факты из списка ниже. ЗАПРЕЩЕНО выдумывать имена, даты, события.\n" +
    "Перекрёстная проверка: если несколько источников совпадают — используй. Если противоречат — укажи обе версии.\n" +
    "НЕ называй людей, дат или событий, которых НЕТ в списке ниже.\n\n" +
    lines.join("\n\n")
  );
}
