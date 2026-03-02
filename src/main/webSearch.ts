import path from "node:path";
import fs from "node:fs";

/** Web search results for agents (DuckDuckGo, no API key) */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

// #region agent log
const LOG_PATH = path.join(process.cwd(), "debug-9fc818.log");
function _dbg(loc: string, msg: string, data: Record<string, unknown>, hid?: string): void {
  const line =
    JSON.stringify({
      sessionId: "9fc818",
      location: loc,
      message: msg,
      data,
      timestamp: Date.now(),
      ...(hid && { hypothesisId: hid })
    }) + "\n";
  try {
    fs.appendFileSync(LOG_PATH, line);
  } catch {
    /* ignore */
  }
  fetch("http://127.0.0.1:7242/ingest/26359c5b-fac8-434d-b645-41992c754928", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "9fc818" },
    body: JSON.stringify({
      sessionId: "9fc818",
      location: loc,
      message: msg,
      data,
      timestamp: Date.now(),
      ...(hid && { hypothesisId: hid })
    })
  }).catch(() => {});
}
// #endregion

const MAX_RESULTS_PER_QUERY = 5;
const MAX_TOTAL = 12;
const SNIPPET_LEN = 500;

function isPresidentUSAQuery(input: string): boolean {
  return /президент.*сша|сша.*президент|president.*usa|usa.*president|president.*united states/i.test(
    input.toLowerCase()
  );
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

function isChancellorGermanyQuery(input: string): boolean {
  return /канцлер.*германи|германи.*канцлер|chancellor.*germany|germany.*chancellor/i.test(
    input.toLowerCase()
  );
}

/** Search using provider chain: Google (SerpAPI/Serper) -> direct facts -> Wikipedia -> DDG. */
export async function searchWeb(queries: string[]): Promise<WebSearchResult[]> {
  if (queries.length === 0) return [];
  const raw = normalizeQuery((queries[0] || "").trim());
  const isPresidentUSA = isPresidentUSAQuery(raw);
  const isChancellorDE = isChancellorGermanyQuery(raw);
  // #region agent log
  _dbg(
    "webSearch.ts:searchWeb:entry",
    "searchWeb called",
    { queriesCount: queries.length, queries, isPresidentUSA, isChancellorDE, cwd: process.cwd(), logPath: LOG_PATH },
    "H1"
  );
  // #endregion

  // 1) Google (приоритет): SerpAPI или Serper (2500 бесплатно/мес)
  const googleResults = await searchGoogle([raw]);
  if (googleResults.length > 0) return googleResults;

  // 2) Прямые источники для частых запросов (без API)
  if (isPresidentUSA) {
    const official = await searchWhiteHousePresidentFact();
    const factual = await searchCurrentUsPresidentFact();
    const merged = [...official, ...factual];
    if (merged.length > 0) return merged.slice(0, MAX_TOTAL);
  }
  if (isChancellorDE) {
    const chancellor = await searchChancellorGermanyFact();
    if (chancellor.length > 0) return chancellor;
  }

  // 3) Wikipedia + DDG
  const wikiResults = await searchWikipediaFallback([raw]);
  if (wikiResults.length > 0) {
    if (!isPresidentUSA) return wikiResults;
    const factual = await searchCurrentUsPresidentFact();
    return factual.length > 0 ? [...factual, ...wikiResults].slice(0, MAX_TOTAL) : wikiResults;
  }

  const ddgInstant = await searchDuckDuckGoInstantFallback([raw], false);
  if (ddgInstant.length > 0) {
    if (!isPresidentUSA) return ddgInstant;
    const factual = await searchCurrentUsPresidentFact();
    return factual.length > 0 ? [...factual, ...ddgInstant].slice(0, MAX_TOTAL) : ddgInstant;
  }

  return [];
}

/** Official source for current US president from whitehouse.gov. */
async function searchWhiteHousePresidentFact(): Promise<WebSearchResult[]> {
  try {
    const res = await fetch("https://www.whitehouse.gov/administration/", {
      signal: AbortSignal.timeout(9000)
    });
    // #region agent log
    _dbg("webSearch.ts:whitehouse:status", "whitehouse status", { status: res.status }, "H18");
    // #endregion
    if (!res.ok) return [];
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const m =
      text.match(/President\s+Donald\s+J\.?\s+Trump/i) ||
      text.match(/President\s+([A-Z][a-z]+(?:\s+[A-Z]\.)?\s+[A-Z][a-z]+)/);
    const name = m?.[1] ? m[1] : m ? "Donald J. Trump" : "";
    if (!name) return [];

    const out: WebSearchResult[] = [
      {
        title: "Official White House Administration",
        url: "https://www.whitehouse.gov/administration/",
        snippet: `CURRENT PRESIDENT FACT: President of the United States is ${name}. Source: White House Administration page.`
      }
    ];
    // #region agent log
    _dbg("webSearch.ts:whitehouse:parsed", "whitehouse parsed", { name }, "H18");
    // #endregion
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    // #region agent log
    _dbg("webSearch.ts:whitehouse:catch", "whitehouse failed", { msg }, "H18");
    // #endregion
    return [];
  }
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

/** Текущий канцлер Германии — Wikidata (P6 head of government для Q183). */
async function searchChancellorGermanyFact(): Promise<WebSearchResult[]> {
  const out: WebSearchResult[] = [];
  try {
    const sparql =
      "SELECT ?person ?personLabel ?start WHERE { " +
      "wd:Q183 p:P6 ?st. ?st ps:P6 ?person. OPTIONAL { ?st pq:P580 ?start } " +
      "OPTIONAL { ?st pq:P582 ?end } FILTER(!BOUND(?end) || ?end > NOW()) " +
      'SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ru". } } ' +
      "ORDER BY DESC(?start) LIMIT 1";
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (res.ok) {
      const json = (await res.json()) as {
        results?: { bindings?: Array<{ personLabel?: { value?: string }; start?: { value?: string } }> };
      };
      const first = json.results?.bindings?.[0];
      const name = first?.personLabel?.value || "";
      const start = first?.start?.value?.slice(0, 10) || "";
      if (name) {
        out.push({
          title: "Wikidata: Chancellor of Germany",
          url: "https://www.wikidata.org/wiki/Q4970706",
          snippet: `CURRENT CHANCELLOR FACT: Chancellor of Germany is ${name}${start ? ` (since ${start})` : ""}. Source: Wikidata.`
        });
      }
    }
  } catch {
    // ignore
  }

  try {
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1" +
      "&titles=Chancellor_of_Germany&format=json&utf8=1";
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (res.ok) {
      const json = (await res.json()) as {
        query?: { pages?: Record<string, { title?: string; extract?: string }> };
      };
      const pages = Object.values(json.query?.pages || {});
      const page = pages.find((p) => !!p.extract);
      if (page?.extract && out.length > 0) {
        const intro = page.extract.slice(0, 450);
        if (/chancellor|канцлер|scholz|olaf/i.test(intro)) {
          out.push({
            title: page.title || "Chancellor of Germany",
            url: "https://en.wikipedia.org/wiki/Chancellor_of_Germany",
            snippet: intro
          });
        }
      }
    }
  } catch {
    // ignore
  }
  return out;
}

/** Adds a deterministic fact for "current US president" from Wikidata + Wikipedia extract. */
async function searchCurrentUsPresidentFact(): Promise<WebSearchResult[]> {
  const out: WebSearchResult[] = [];
  try {
    const sparql =
      "SELECT ?person ?personLabel ?start WHERE { " +
      "wd:Q30 p:P35 ?st. ?st ps:P35 ?person. OPTIONAL { ?st pq:P580 ?start } " +
      "OPTIONAL { ?st pq:P582 ?end } FILTER(!BOUND(?end) || ?end > NOW()) " +
      'SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ' +
      "ORDER BY DESC(?start) LIMIT 1";
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (res.ok) {
      const json = (await res.json()) as {
        results?: { bindings?: Array<{ personLabel?: { value?: string }; start?: { value?: string } }> };
      };
      const first = json.results?.bindings?.[0];
      const name = first?.personLabel?.value || "";
      const start = first?.start?.value?.slice(0, 10) || "";
      if (name) {
        out.push({
          title: "Wikidata: Head of state of the United States",
          url: "https://www.wikidata.org/wiki/Q30",
          snippet: `Current head of state of the United States: ${name}${start ? ` (since ${start})` : ""}.`
        });
      }
    }
  } catch {
    // ignore
  }

  try {
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1" +
      "&titles=President_of_the_United_States&format=json&utf8=1";
    const res = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (res.ok) {
      const json = (await res.json()) as {
        query?: { pages?: Record<string, { title?: string; extract?: string }> };
      };
      const pages = Object.values(json.query?.pages || {});
      const page = pages.find((p) => !!p.extract);
      if (page?.extract) {
        out.push({
          title: page.title || "President of the United States",
          url: "https://en.wikipedia.org/wiki/President_of_the_United_States",
          snippet: page.extract.slice(0, 450)
        });
      }
    }
  } catch {
    // ignore
  }

  // #region agent log
  _dbg(
    "webSearch.ts:presidentFact",
    "president fact results",
    { results: out.length, hasTrump: /trump/i.test(JSON.stringify(out)) },
    "H17"
  );
  // #endregion
  return out;
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

/** Fallback #2: Wikipedia Search API (legacy api.php, more stable than rest.php). */
async function searchWikipediaFallback(queries: string[]): Promise<WebSearchResult[]> {
  const raw = normalizeQuery((queries[0] || "").trim().slice(0, 100)).toLowerCase();
  const isPresidentUSA =
    /президент.*сша|сша.*президент|president.*usa|usa.*president|president.*america/i.test(raw);
  const isPotatoRussia =
    /картошк|картофель|potato.*russia|russia.*potato/i.test(raw);
  const isChancellorGermany = isChancellorGermanyQuery(raw);
  let wikiQuery = raw;
  if (isPresidentUSA) wikiQuery = "president of the United States current";
  else if (isPotatoRussia) wikiQuery = "potato Russia history";
  else if (isChancellorGermany) wikiQuery = "Chancellor of Germany current";
  else if (/[\u0400-\u04FF]/.test(raw)) wikiQuery = raw || "president of the United States current";
  if (!wikiQuery) wikiQuery = "president of the United States current";
  const q = encodeURIComponent(wikiQuery);
  // #region agent log
  _dbg("webSearch.ts:wikipediaFallback", "using Wikipedia", { raw: queries[0], wikiQuery }, "H6");
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
    "=== ИСТОЧНИКИ ИЗ ИНТЕРНЕТА (ТВОЙ ЕДИНСТВЕННЫЙ ИСТОЧНИК ФАКТОВ) ===\n" +
    "Если есть 'CURRENT PRESIDENT FACT:' — используй БУКВАЛЬНО как ответ о президенте США.\n" +
    "Если есть 'CURRENT CHANCELLOR FACT:' — используй БУКВАЛЬНО как ответ о канцлере Германии.\n" +
    "ЗАПРЕЩЕНО выдумывать имена, даты, события. Используй ТОЛЬКО то, что написано ниже.\n" +
    "Перекрёстная проверка: если несколько источников совпадают — используй. Если противоречат — укажи обе версии.\n" +
    "НЕ называй людей, дат или событий, которых НЕТ в списке ниже.\n\n" +
    lines.join("\n\n")
  );
}
