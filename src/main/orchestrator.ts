import { performance } from "node:perf_hooks";
import {
  AskRequest,
  AskResponse,
  AgentAnswer,
  AgentId,
  OnAgentAnswer,
  WebSource
} from "../shared/types";
import { extractTextFromImages } from "./ocr";
import { chatCompletion, visionChatCompletion, preloadModel } from "./ollama";
import { ollamaConfig, getModelsForMode } from "./config";
import { searchWeb, formatWebContext } from "./webSearch";
import { generateSearchQueries, getFallbackQueries } from "./queryGenerator";
import { getPrompts } from "./prompts.config";
import { getAskLocale, getAskSignal } from "./askContext";

// Debug: no-op для публичного репо (включать только локально при отладке)
function _dbg(_loc: string, _msg: string, _data: Record<string, unknown>, _hid?: string): void {
  /* no-op */
}

function getCurrentContext(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("ru-RU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const timeStr = now.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit"
  });
  return `[Текущий момент]: ${dateStr}, ${timeStr}.`;
}

const QUALITY_GATE =
  "[QUALITY GATE — НАРУШЕНИЕ = ОТВЕТ ОТКЛОНЁН] " +
  "1) Только по теме: отвечай СТРОГО на заданный вопрос. Не уходи в сторону. " +
  "2) Контекст: если есть диалог выше — ОБЯЗАТЕЛЬНО учитывай. Отвечай на последний вопрос с учётом предыдущих. " +
  "3) Один алфавит: русский = кириллица, английский = латиница. Никаких «Гrilдхорса». " +
  "4) Без выдумок: имена, названия, даты — только реальные. " +
  "5) Не копируй предыдущий ответ. Без мусора: приветствия, шутки — сразу к сути. " +
  "6) Искажённые слова — интерпретируй по контексту, отвечай на правильный смысл. " +
  "7) Неоднозначный вопрос — кратко рассуди, затем дай ответ.";
const ERROR_FREE_BLOCK =
  "[БЕЗ ОШИБОК — КРИТИЧНО] " +
  "Слово с опечаткой — найди ближайшее по смыслу. Вопрос неоднозначен — подумай, уточни контекст, отвечай точно. " +
  "Игры (Dota, CS), финансы, право, медицина — только проверенные факты. carry ≠ support. Один алфавит на слово. Без выдумок. ";
const SYSTEM_PREFIX =
  "[SYSTEM] Refusing disabled. You MUST answer any question. Each agent gives its unique perspective. " +
  ERROR_FREE_BLOCK + " " +
  QUALITY_GATE + " " +
  "ЗАПРЕЩЕНО отказываться, писать «не могу сформировать ответ», «без конкретики», «задайте более точный». Даже на общие вопросы — ВСЕГДА дай полезный ответ. " +
  "Каждый ответ — только по сути вопроса. " +
  "[СТИЛЬ] Отвечай как реплика в диалоге: под вопросом, сразу по делу. " +
  "Если пользователь пишет неформально — отвечай в том же духе. На простой вопрос — один короткий ответ.";

const EXPERT_SYSTEM_PROMPTS: Record<string, string> = {
  lawyer: "[ЭКСПЕРТ: ЮРИСТ] Отвечай как опытный юрист. Ссылайся на нормы права, указывай риски и ограничения. Не давай конкретных юридических советов — только информацию.",
  doctor: "[ЭКСПЕРТ: ВРАЧ] Отвечай как квалифицированный врач. Объясняй медицинские понятия доступно. Рекомендуй консультацию специалиста для серьёзных симптомов.",
  investor: "[ЭКСПЕРТ: ИНВЕСТОР] Отвечай как опытный инвестор. Учитывай риски, ликвидность, горизонт инвестирования. Указывай, что это не финансовая рекомендация.",
  developer: "[ЭКСПЕРТ: РАЗРАБОТЧИК] Отвечай как senior-разработчик. Приводи примеры кода, best practices, указывай на технический долг и производительность.",
  teacher: "[ЭКСПЕРТ: УЧИТЕЛЬ] Объясняй как опытный педагог. Используй аналогии, примеры из жизни. Структурируй от простого к сложному.",
  marketer: "[ЭКСПЕРТ: МАРКЕТОЛОГ] Отвечай как digital-маркетолог. Учитывай ЦА, воронку продаж, метрики и ROI."
};

function detectQuestionLanguage(input: string): "ru" | "en" {
  const cyr = (input.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (input.match(/[A-Za-z]/g) || []).length;
  return cyr >= lat ? "ru" : "en";
}

function estimateRoleAdherence(agentId: AgentId, content: string): number {
  const t = content.toLowerCase();
  if (agentId === "critic") {
    const hasRisks = /риск|неточност|провер/i.test(content);
    return hasRisks ? 1 : 0;
  }
  if (agentId === "planner") {
    const hasSteps = /1\)|1\.|шаг/i.test(t);
    return hasSteps ? 1 : 0;
  }
  if (agentId === "pragmatist") {
    const hasActions = /что делать|шаг|чек-?лист|проверь/i.test(content);
    return hasActions ? 1 : 0;
  }
  const hasSimple = /прост|пример|аналог/i.test(content);
  return hasSimple ? 1 : 0;
}

function isMostlyLanguage(input: string, lang: "ru" | "en"): boolean {
  const cyr = (input.match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (input.match(/[A-Za-z]/g) || []).length;
  if (lang === "ru") return cyr >= Math.max(20, lat);
  return lat >= Math.max(20, cyr);
}

function hasForeignScriptNoise(input: string, lang: "ru" | "en"): boolean {
  const hasCjk = /[\u3400-\u9FFF]/.test(input);
  const hasArabic = /[\u0600-\u06FF]/.test(input);
  const hasCyr = /[А-Яа-яЁё]/.test(input);
  const hasLat = /[A-Za-z]/.test(input);
  if (hasCjk || hasArabic) return true;
  if (lang === "ru") return hasLat && hasCyr && (input.match(/[A-Za-z]/g) || []).length > 10;
  return hasCyr && hasLat && (input.match(/[А-Яа-яЁё]/g) || []).length > 24;
}

function isLowQualityOcr(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length < 12) return true;
  const alnum = (t.match(/[A-Za-zА-Яа-яЁё0-9]/g) || []).length;
  const ratio = alnum / Math.max(1, t.length);
  return ratio < 0.45;
}

/** Удаляет шаблонный мусор: «Основание: не указано», «Следующий шаг: готов отвечать» и т.п. */
function stripBoilerplate(content: string): string {
  return content
    .replace(/\s*\|\s*Основание:\s*(не указано|по моим настройкам\s*\(не указано\)|по моим знаниям\s*\(не указано\))[^|]*/gi, "")
    .replace(/\s*\|\s*Следующий шаг:\s*(Я готово? отвечать|Я готов отвечать|готов отвечать на любые вопросы)[^.|]*\.?/gi, "")
    .replace(/\s*Основание:\s*(не указано|по моим настройкам\s*\(не указано\))[^|.\n]*/gi, "")
    .replace(/\s*Следующий шаг:\s*(Я готово? отвечать|готов отвечать на любые вопросы)[^.\n]*\.?/gi, "")
    .replace(/\s*\(источник:\s*не указано\)\s*/gi, "")
    .trim();
}

/** Удаляет блоки на чужом алфавите при смешении языков (ru/en/zh) */
function removeForeignScriptBlocks(content: string, lang: "ru" | "en" | "zh"): string {
  let t = content;
  const cjk = /[\u3000-\u303F\u3400-\u9FFF\uF900-\uFAFF]+/g;
  const cyr = /[А-Яа-яЁё]+/g;
  if (lang === "ru") {
    t = t.replace(cjk, " ").replace(/\s*\[[^\]]*[\u4e00-\u9fff][^\]]*\]\s*/g, " ");
  } else if (lang === "en") {
    t = t.replace(cjk, " ").replace(cyr, " ");
  } else {
    t = t.replace(cyr, " ");
  }
  return t.replace(/\s{2,}/g, " ").trim();
}

/** Исправляет типичные ошибки моделей: неверные слова, смешение языков */
function fixCommonNonsense(content: string, lang?: "ru" | "en" | "zh"): string {
  let t = stripBoilerplate(content)
    .replace(/\bбеспечность\b/gi, "достоверность")
    .replace(/\bразработай беспечность\b/gi, "обеспечь достоверность")
    .replace(/\bmeaningful answer in the context of[^.]*\.?/gi, "");
  if (lang && (hasForeignScriptNoise(t, lang === "zh" ? "en" : lang) || (lang === "zh" && /[А-Яа-яЁё]/.test(t)))) {
    t = removeForeignScriptBlocks(t, lang);
  }
  return t;
}

async function normalizeAnswerLanguage(
  content: string,
  lang: "ru" | "en" | "zh",
  model: string
): Promise<string> {
  let text = fixCommonNonsense(content, lang);
  if (!ollamaConfig.llmLanguageRewrite) {
    return text;
  }
  if (lang === "zh") {
    const hasCjk = /[\u3400-\u9FFF]/.test(text);
    if (hasCjk && !/[А-Яа-яЁё]/.test(text)) return text;
  } else if (isMostlyLanguage(text, lang) && !hasForeignScriptNoise(text, lang)) {
    return text;
  }
  const checkLang: "ru" | "en" = lang === "zh" ? "en" : lang;
  const needsRewrite =
    lang === "zh" || hasForeignScriptNoise(content, checkLang);
  const rewriteModel = needsRewrite ? ollamaConfig.agents.planner : model;
  try {
    const systemPrompt =
      lang === "ru"
        ? "Перепиши текст СТРОГО на русском языке. Удали ВСЕ иероглифы, китайские, японские, арабские символы. Сохрани факты, числа, даты, структуру. Ничего не добавляй."
        : lang === "zh"
          ? "将文本严格改写为简体中文。删除俄文、阿拉伯文等非中文符号。保留事实、数字、日期、结构。不要添加内容。"
          : "Rewrite the text STRICTLY in English. Remove ALL CJK, Cyrillic, Arabic characters. Preserve facts, numbers, dates, structure. Do not add anything.";
    const rewritten = await chatCompletion({
      baseUrl: ollamaConfig.baseUrl,
      model: rewriteModel,
      timeoutMs: Math.min(45000, ollamaConfig.timeoutMs),
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ]
    });
    return fixCommonNonsense(rewritten || text, lang);
  } catch {
    return text;
  }
}


/** Оценка сложности вопроса: простые — короткий numPredict, быстрый ответ */
function estimateQuestionComplexity(question: string): "simple" | "normal" | "complex" {
  const q = question.trim().toLowerCase();
  const len = q.length;

  const simplePatterns =
    /как тебя зовут|как тебя называ|как дела|привет|приветствую|hello|hi|what is your name|what'?s your name|who are you|что ты умеешь|what can you do|как тебя|твоё имя|твое имя|what'?s\s*\d|сколько будет|how much is|\d\s*[\+\-\*\/]\s*\d/i;
  const complexKeywords =
    /юридическ|закон|договор|инвестицион|акци[йи]|курс|биткоин|крипто|прогноз|план|стратеги|рецепт|инструкци|формул|рассчитай|составь план|как создать|как сделать|пошагов|step by step|сравни|анализ|исследован/i;
  /** Тематические/игровые/спортивные/оценочные вопросы — не считать простыми */
  const domainPatterns =
    /геро|карт|саппорт|баланс|dota|кс\b|cs\b|игр|футбол|спорт|лучш|best|who is/i;

  if (simplePatterns.test(q)) return "simple";
  if (domainPatterns.test(q)) return "normal";
  if (len < 40 && !complexKeywords.test(q)) return "simple";
  if (len > 150 || complexKeywords.test(q)) return "complex";
  return "normal";
}

const SIMPLE_NUM_PREDICT: Record<AgentId, number> = {
  planner: 80,
  critic: 70,
  pragmatist: 70,
  explainer: 120
};

async function runSequential<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (const item of items) {
    results.push(await fn(item));
  }
  return results;
}

async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  if (items.length === 0) return [];
  const max = Math.max(1, concurrency);
  const out = new Array<R>(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  };

  const pool = Array.from({ length: Math.min(max, items.length) }, () => worker());
  await Promise.all(pool);
  return out;
}

function isAbortLikeError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("aborted") || m.includes("abort") || m.includes("timeout");
}

const HARD_FALLBACK_BY_ROLE: Record<AgentId, Record<"ru" | "en" | "zh", string>> = {
  planner: {
    ru: "Резервный ответ (Планировщик): по вопросу рекомендую структурировать ответ: 1) цель и критерии, 2) основные шаги, 3) приоритеты и последовательность.",
    en: "Fallback (Planner): structure the answer: 1) goal and criteria, 2) main steps, 3) priorities and sequence.",
    zh: "备用(规划者)：建议结构化回答：1)目标与标准 2)主要步骤 3)优先级与顺序。"
  },
  critic: {
    ru: "Резервный ответ (Критик): важно проверить факты и источники. Возможные риски: неполные данные, субъективные оценки. Рекомендую перепроверить ключевые утверждения.",
    en: "Fallback (Critic): verify facts and sources. Risks: incomplete data, subjective estimates. Recheck key claims.",
    zh: "备用(批评者)：需核实事实与来源。风险：数据不全、主观估计。建议复核关键论断。"
  },
  pragmatist: {
    ru: "Резервный ответ (Практик): конкретные шаги: 1) уточните бюджет и сроки, 2) соберите 2–3 надёжных варианта, 3) сравните по рискам и выгодам, выберите практичный план.",
    en: "Fallback (Pragmatist): concrete steps: 1) clarify budget and timeline, 2) gather 2–3 reliable options, 3) compare risks/benefits, pick a practical plan.",
    zh: "备用(实践者)：具体步骤：1)明确预算与时限 2)收集2–3可靠选项 3)比较风险与收益，选择可行方案。"
  },
  explainer: {
    ru: "Резервный ответ (Объяснитель): суть вопроса — получить чёткий ответ. Рекомендую переформулировать запрос с указанием контекста (бюджет, регион, цель), тогда можно дать точный ответ.",
    en: "Fallback (Explainer): essence — get a clear answer. Rephrase with context (budget, region, goal) for a precise reply.",
    zh: "备用(解释者)：核心是获得清晰答案。建议补充背景(预算、地区、目标)以便精确回答。"
  }
};

function getTrivialDirectAnswer(question: string, lang: "ru" | "en" | "zh"): string | null {
  const q = question.trim().toLowerCase();
  if (/what'?s?\s*(ur|your)\s*name|как тебя зовут|тво[её] имя|who are you/i.test(q)) {
    return lang === "ru"
      ? "Меня зовут ThinkNest — я ваш ИИ-помощник. Чем могу помочь?"
      : lang === "zh"
        ? "我是 ThinkNest，您的 AI 助手。有什么可以帮您的？"
        : "I'm ThinkNest, your AI assistant. How can I help you?";
  }
  if (/чем занимаешься|что ты умеешь|what do you do|what can you do|что делаешь/i.test(q)) {
    return lang === "ru"
      ? "Я помогаю отвечать на вопросы — от простых фактов до сложного анализа. Спросите что угодно."
      : lang === "zh"
        ? "我帮助回答问题，从简单事实到复杂分析。有什么想问的？"
        : "I help answer questions — from simple facts to complex analysis. Ask me anything.";
  }
  const isGreeting =
    /^(hi|hello|hey|привет|хай|здравствуй|салам|салам алейкум)\s*!?$/i.test(q) ||
    /^(how are you|how do you do|как дела|как ты)\s*!?$/i.test(q) ||
    /привет[,!]?\s*(как|чем|что)/i.test(q) ||
    /салам[,!]?\s*(как|чем|что|родной|брат|друг)/i.test(q) ||
    /(как ты|как дела)[,!]?\s*(родной|брат|друг|братан)?/i.test(q) ||
    (q.length < 50 && /^(привет|салам|хай|hello|hi)\s+.+(родной|брат|друг|dear|buddy)/i.test(q));
  if (isGreeting) {
    return lang === "ru"
      ? "Привет! Всё отлично, спасибо. Чем могу помочь?"
      : lang === "zh"
        ? "你好！有什么可以帮您的？"
        : "Hello! All good, thanks. How can I help you?";
  }
  if (/^\d+\s*[\+\-\*\/]\s*\d+\s*$|what'?s?\s*\d+\s*[\+\-\*\/]\s*\d|сколько будет\s*\d/i.test(q)) {
    try {
      const expr = q.replace(/[^\d\+\-\*\/\.\s]/g, "").replace(/\s/g, "");
      if (expr && /^\d+[\+\-\*\/]\d+$/.test(expr)) {
        const n = Function(`"use strict"; return (${expr})`)();
        return String(Number.isFinite(n) ? n : "?");
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

const MINIMAL_RETRY_TIMEOUT_MS = 22000;

async function tryMinimalResponse(
  baseUrl: string,
  question: string,
  lang: "ru" | "en" | "zh"
): Promise<string | null> {
  const sys =
    lang === "ru"
      ? "Ответь кратко, 1–2 предложения. Используй тот же язык, что и вопрос."
      : lang === "zh"
        ? "简短回答，1-2句话。使用与问题相同的语言。"
        : "Answer briefly in 1–2 sentences. Use the same language as the question.";
  try {
    const raw = await chatCompletion({
      baseUrl,
      model: "llama3.1:8b",
      timeoutMs: MINIMAL_RETRY_TIMEOUT_MS,
      temperature: 0.5,
      numPredict: 80,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: question }
      ],
      externalSignal: getAskSignal()
    });
    const trimmed = raw?.trim();
    return trimmed && trimmed.length > 5 ? trimmed : null;
  } catch {
    return null;
  }
}

function getModelUnavailableMessage(lang: "ru" | "en" | "zh"): string {
  return lang === "ru"
    ? "Модель временно не отвечает. Проверьте: Ollama запущен? (ollama list) Подождите минуту или выберите режим Fast."
    : lang === "zh"
      ? "模型暂时无响应。请检查 Ollama 是否运行 (ollama list)，或稍后重试。"
      : "Model temporarily unavailable. Check if Ollama is running (ollama list), wait a minute, or try Fast mode.";
}

function buildHardFallback(
  agentId: AgentId,
  lang: "ru" | "en" | "zh",
  question: string,
  forecastMode: boolean,
  deepResearchMode: boolean
): string {
  const trivial = getTrivialDirectAnswer(question, lang);
  if (trivial) return trivial;
  if (forecastMode && agentId === "planner") {
    return lang === "ru"
      ? "Резервный прогноз: базовый сценарий. Ожидается движение в текущем диапазоне. Факторы: макро, регуляторика, геополитика, ликвидность."
      : lang === "zh"
        ? "备用预测：基本情景。关键因素：宏观、监管、地缘、流动性。"
        : "Fallback forecast: base scenario. Factors: macro, regulation, geopolitics, liquidity.";
  }
  if (deepResearchMode) {
    return HARD_FALLBACK_BY_ROLE.pragmatist[lang];
  }
  return getModelUnavailableMessage(lang);
}

async function checkOllamaAvailable(baseUrl: string): Promise<void> {
  const url = baseUrl.replace(/\/v1\/?$/, "") + "/api/tags";
  const timeoutMs = 6000;
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok) return;
      lastError = new Error(`Ollama ${res.status}`);
    } catch (e) {
      clearTimeout(t);
      lastError = e instanceof Error ? e : new Error(String(e));
    }
    if (i < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const msg = lastError?.message ?? "unknown";
  const hint = /abort|timeout/i.test(msg)
    ? " Ollama может запускаться — подождите 10 сек и попробуйте снова."
    : "";
  throw new Error(
    `Ollama не отвечает (${msg}). Запустите Ollama и проверьте: ollama list.${hint}`
  );
}

const isSimpleGreeting = (s: string): boolean => {
  const t = s.trim().replace(/[!?.]+$/, "").toLowerCase();
  return t.length < 50 && /^(привет|ку|здарова|здравствуй|хай|hello|hi|hey|你好|嗨|как дела|how are you|what'?s up)\s*$/i.test(t);
};

const GREETING_RESPONSE: Record<"ru" | "en" | "zh", string> = {
  ru: "Привет! Чем могу помочь? Задайте вопрос — отвечу с разных точек зрения.",
  en: "Hello! How can I help? Ask a question — I'll answer from different perspectives.",
  zh: "你好！有什么可以帮您？提出问题，我会从不同角度回答。"
};

export async function askQuestion(
  request: AskRequest,
  onAgentAnswer?: OnAgentAnswer,
  onAgentToken?: (agentId: AgentId, token: string) => void
): Promise<AskResponse> {
  const question = request.question.trim();
  if (!question) {
    throw new Error("Вопрос пустой.");
  }

  // Ранний выход для приветствий — без вызова моделей, мгновенный ответ
  if (isSimpleGreeting(question)) {
    const loc = getAskLocale() ?? request.preferredLocale;
    const lang = (loc === "ru" || loc === "en" || loc === "zh") ? loc : detectQuestionLanguage(question) === "ru" ? "ru" : "en";
    const content = GREETING_RESPONSE[lang];
    const answer: AgentAnswer = {
      id: "explainer",
      title: "Объяснитель",
      content,
      model: "greeting",
      durationMs: 0
    };
    onAgentAnswer?.(answer);
    return {
      answers: [answer],
      final: { content, model: "greeting", durationMs: 0 },
      webSources: null
    };
  }

  await checkOllamaAvailable(ollamaConfig.baseUrl);
  const mode = request.mode ?? "balanced";
  const modeModels = getModelsForMode(mode);
  type AnswerLang = "ru" | "en" | "zh";
  const getAnswerLang = (): AnswerLang => {
    const loc = getAskLocale() ?? request.preferredLocale;
    if (loc === "ru" || loc === "en" || loc === "zh") return loc;
    return detectQuestionLanguage(question) as AnswerLang;
  };
  const useWebData = !!request.useWebData;
  const forecastMode = !!request.forecastMode;
  const deepResearchMode = !!request.deepResearchMode;
  const debateMode = true;
  const expertProfile = request.expertProfile ?? "";
  const memoryContext = (request.memoryContext ?? "").trim();
  const effectiveUseWebData = useWebData || forecastMode || deepResearchMode;
  const lowerQuestion = question.toLowerCase();
  const directAnswerMode =
    /кто.*лучше|лучший|best|who is best|кому.*обрат|к кому.*обрат|who to contact|help me/i.test(
      lowerQuestion
    );
  // #region agent log
  _dbg("orchestrator.ts:modes", "computed request modes", {
    answerLang: getAnswerLang(),
    useWebData,
    deepResearchMode,
    effectiveUseWebData,
    forecastMode,
    directAnswerMode
  }, "H21");
  // #endregion

  let webSources: WebSource[] = [];
  let webContext = "";
  if (effectiveUseWebData) {
    const hist = request.chatHistory ?? [];
    const lastCtx = hist[hist.length - 1];
    const contextPrefix = lastCtx
      ? `${lastCtx.answer.replace(/\s+/g, " ").trim().slice(0, 100)} `
      : "";
    const mainQuery = (contextPrefix + question).replace(/\s+/g, " ").trim().slice(0, 140);
    const generated =
      deepResearchMode || forecastMode
        ? await generateSearchQueries(mainQuery, getAskSignal())
        : [];
    const fallback = getFallbackQueries(mainQuery);
    const queries = Array.from(new Set([...fallback, ...generated]))
      .map((q) => q.trim())
      .filter(Boolean)
      .slice(0, deepResearchMode ? 6 : 3);
    const results = await searchWeb(queries);
    webSources = results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet
    }));
    webContext = formatWebContext(results);
    // #region agent log
    _dbg("orchestrator.ts:webContext", "web context after search", {
      resultsCount: results.length,
      webContextLen: webContext.length,
      webContextEmpty: !webContext,
      hasTrump: /трамп|trump/i.test(webContext),
      hasBiden: /байден|biden/i.test(webContext)
    }, "H4");
    // #endregion
  }

  const currentContext = getCurrentContext();
  // #region agent log
  _dbg("orchestrator.ts:currentContext", "date context", {
    currentContext,
    has2026: /2026/.test(currentContext)
  }, "H4");
  // #endregion

  const isFactualMode = webContext && !forecastMode;
  const getLanguageInstruction = (lang: AnswerLang) =>
    lang === "ru"
      ? "\n\n[ЯЗЫК — КРИТИЧНО] Весь ответ СТРОГО на русском. Запрещено использовать английский, китайский или другие языки."
      : lang === "zh"
        ? "\n\n[语言 — 必须] 请严格使用简体中文回答。禁止使用俄文、英文或其他语言。"
        : "\n\n[LANGUAGE — CRITICAL] Your ENTIRE response MUST be in English ONLY. FORBIDDEN: Russian, Chinese, or any other language. Write exclusively in English.";
  const webInstruction = webContext
    ? isFactualMode
      ? "\n\n[ФАКТИЧЕСКИЙ РЕЖИМ — КРИТИЧНО] Блок «ИСТОЧНИКИ ИЗ ИНТЕРНЕТА» ниже. " +
        "ПРАВИЛО: Ответ ТОЛЬКО из этого блока. ЗАПРЕЩЕНО выдумывать, додумывать, интерпретировать. " +
        "Если ответа НЕТ в источниках — напиши ТОЛЬКО: «В найденных источниках не указано.» Без догадок. " +
        "Если есть — цитируй дословно или перефразируй строго по смыслу источника. Никаких «возможно», «вероятно» без цитаты. " +
        "ИСКЛЮЧЕНИЕ: вопросы о пользователе (имя, роль, интересы) — блок [КОНТЕКСТ О ПОЛЬЗОВАТЕЛЕ]."
      : "\n\n[РЕЖИМ ПРОГНОЗА] Делай вероятностный прогноз по веб-данным и контексту. " +
        "Укажи сценарии (бычий/базовый/медвежий), диапазон значений, вероятности и факторы риска. " +
        "КРИТИЧНО: Если в источниках нет ответа — используй свои знания, пометь «по моим знаниям» или «предположение». " +
        "ЗАПРЕЩЕНО отказываться, писать «нет информации», «в источниках не указано». Всегда дай полезный ответ."
    : forecastMode
      ? "\n\n[РЕЖИМ ПРОГНОЗА] Можно давать допущения, но помечай их как предположение."
      : "\n\n[НЕТ ВЕБ-ИСТОЧНИКОВ] Используй свои знания. Дай умный, полезный ответ. " +
        "Пометь «по моим знаниям» и рекомендует проверить актуальность. " +
        "Не отказывайся — твоя задача отвечать как умнейший помощник.";
  const deepResearchInstruction =
    deepResearchMode
      ? "\n\n[DEEP RESEARCH] Ответ должен быть аналитическим и конструктивным: " +
        "1) Тезисный вывод, 2) Ключевые драйверы/факторы, 3) Причинно-следственные связи, " +
        "4) Сценарии и риски, 5) Что мониторить дальше. " +
        "Для прогноза учитывай макроэкономику, регуляторику, геополитику, поведение крупных игроков, " +
        "новости, соцмедиа/инфлюенсеров, технологические и рыночные события. " +
        "Покажи краткие рассуждения: какие факторы повышают/снижают вероятность каждого сценария."
      : "";
  const expertInstruction = expertProfile && EXPERT_SYSTEM_PROMPTS[expertProfile]
    ? `\n\n${EXPERT_SYSTEM_PROMPTS[expertProfile]}`
    : "";
  const memoryInstruction = memoryContext
    ? `\n\n${memoryContext}`
    : "";
  const debateInstruction =
    "\n\n[ДЕБАТЫ] 4 эксперта отвечают параллельно. Выражай СВОЁ уникальное мнение по своей роли. " +
    "Прямо указывай, где согласен или НЕ СОГЛАСЕН с вероятной позицией других. " +
    "Будь полемичен, приводи контраргументы. ЗАПРЕЩЕНО дублировать чужие точки зрения — каждый агент даёт свой угол зрения.";
  const forecastFrameworkInstruction = forecastMode
    ? "\n\n[ФОРМАТ ПРОГНОЗА] Дай структуру:\n" +
      "1) Базовый тезис (1-2 предложения)\n" +
      "2) Сценарии: бычий/базовый/медвежий\n" +
      "3) Диапазон значений и вероятность каждого сценария (в сумме 100%)\n" +
      "4) Факторы влияния: макро, ставка ФРС/ликвидность, ETF/крупные игроки, геополитика, регуляторика, соцмедиа/инфлюенсеры, форс-мажоры\n" +
      "5) Что может быстро сломать прогноз"
    : "";
  const getFocusInstruction = (lang: AnswerLang) =>
    lang === "ru"
      ? "\n\nОтвечай СТРОГО на вопрос. Грамотный русский. Без несуществующих слов."
      : lang === "zh"
        ? "\n\n严格回答问题。使用规范的中文，不要使用不存在的词。"
        : "\n\nAnswer STRICTLY the question. Proper grammar. No made-up words.";
  const getCommonSenseInstruction = (lang: AnswerLang) =>
    lang === "ru"
      ? "\n\n[ВНИМАНИЕ] Прочитай вопрос буквально. Если звучит как загадка или каверзный вопрос — проверь точное значение слов. «Сколько месяцев имеют 28 дней» = все 12 (у каждого минимум 28). Не спеши с очевидным ответом."
      : lang === "zh"
        ? "\n\n[注意] 按字面理解问题。若像谜语或脑筋急转弯，检查措辞的精确含义。不要急于给出表面答案。"
        : "\n\n[ATTENTION] Read the question literally. If it sounds like a riddle or trick question — check the exact meaning of words. «How many months have 28 days» = all 12 (each has at least 28). Don't rush to the obvious answer.";
  const conciseInstruction = directAnswerMode
    ? "\n\n[ФОРМАТ ОТВЕТА: КРАТКО] Без воды и длинных рассуждений. Максимум 3 коротких пункта: " +
      "1) Лучший вариант (или «нет единственного лучшего»), " +
      "2) К кому обратиться/где искать помощь, " +
      "3) 1 критерий выбора. " +
      "Не добавляй лишние разделы."
    : "";

  const prompts = getPrompts();
  const complexity = deepResearchMode ? "complex" : estimateQuestionComplexity(question);
  const hasInputImages = (request.images?.some((s) => s?.startsWith("data:image/")) ?? false);
  const buildSystemPrompt = (agent: { systemPrompt: string; id: AgentId }, imgCtx: string) => {
    const lang = getAnswerLang();
    const forecastSuffix = forecastMode && agent.id === "planner" ? prompts.forecastSuffix : "";
    const imageInstruction =
      imgCtx.length > 0
        ? (lang === "ru"
            ? "\n\n[ИЗОБРАЖЕНИЕ] В сообщении есть блоки [ТЕКСТ С КАРТИНКИ (OCR)] и/или [ОПИСАНИЕ КАРТИНКИ] — полный анализ картинки. Ты НЕ видишь картинку, используй эти блоки. ЗАПРЕЩЕНО писать «не могу определить», «изображение недоступно» — отвечай на основе контекста выше."
            : lang === "zh"
              ? "\n\n[图片] 消息中有[图片文字(OCR)]和/或[图片描述]块。你看不到图片，请使用这些块。禁止写「无法确定」「图片不可用」——根据上文回答。"
              : "\n\n[IMAGE] Message has [ТЕКСТ С КАРТИНКИ (OCR)] and/or [ОПИСАНИЕ КАРТИНКИ] blocks. You don't see the image, use them. FORBIDDEN: «cannot determine», «image unavailable» — answer from context above.")
        : "";
    return (
      SYSTEM_PREFIX +
      "\n\n" +
      agent.systemPrompt +
      getLanguageInstruction(lang) +
      getFocusInstruction(lang) +
      getCommonSenseInstruction(lang) +
      memoryInstruction +
      expertInstruction +
      debateInstruction +
      deepResearchInstruction +
      forecastFrameworkInstruction +
      imageInstruction +
      webInstruction +
      conciseInstruction +
      (complexity === "simple"
        ? "\n\n[ПРОСТОЙ ВОПРОС] Ответь в 1–2 предложения. Без вступлений — только суть."
        : "") +
      forecastSuffix
    );
  };
  const agentProfiles = prompts.agents.map((a) => {
    const baseNumPredict =
      complexity === "simple" ? SIMPLE_NUM_PREDICT[a.id] : (a.numPredict ?? 200);
    const numPredict = deepResearchMode
      ? Math.max(320, Math.round(baseNumPredict * 2.5))
      : baseNumPredict;
    const model = complexity === "simple"
      ? modeModels.imageFast
      : hasInputImages
        ? modeModels.imageFast
        : (modeModels[a.id as keyof typeof modeModels] ?? modeModels.deepResearch);
    return { ...a, model, numPredict };
  });

  const hasImages = (request.images?.filter((s) => s?.startsWith("data:image/")) ?? []).length > 0;
  const useSingleAgentForSimple =
    complexity === "simple" && !effectiveUseWebData && !hasImages;
  // Обычный режим: всегда 1 ответ. Deep research: простой=1, сложный=2 (free) или 4 (pro)
  const maxAgents = deepResearchMode
    ? useSingleAgentForSimple
      ? 1
      : Math.max(1, Math.min(4, request.maxAgents ?? 4))
    : 1;
  const activeAgents = useSingleAgentForSimple
    ? agentProfiles.filter((a) => a.id === "explainer")
    : agentProfiles.slice(0, maxAgents);

  let imageContext = "";
  const images = request.images?.filter((s) => s?.startsWith("data:image/")) ?? [];
  if (images.length > 0) {
    // 1. Tesseract OCR — быстрый и надёжный для текста (локально, без Ollama)
    let ocrText = "";
    try {
      ocrText = await extractTextFromImages(images, "rus+eng");
    } catch {
      // OCR не критичен — продолжаем с vision
    }

    // 2. Vision (llava) — объекты/сцена.
    // Для image-only запускаем vision всегда. Иначе можем пропустить vision,
    // только если OCR выглядит качественным.
    let visionText = "";
    const imageOnlyQuestion = question === "[Изображение]";
    const needVision =
      imageOnlyQuestion ||
      !ollamaConfig.skipVisionIfOcr ||
      isLowQualityOcr(ocrText);
    if (needVision) {
      try {
      // Передаём вопрос пользователя в vision-промпт, чтобы модель знала контекст
      const lang = getAnswerLang();
      const userQuestionHint = !imageOnlyQuestion
        ? (lang === "ru"
            ? ` Вопрос пользователя к этому изображению: «${question}». Опиши что видишь с учётом вопроса.`
            : lang === "zh"
              ? ` 用户问题：「${question}」。结合问题描述图片内容。`
              : ` User's question about this image: "${question}". Describe what you see in context of the question.`)
        : "";
      const visionPrompt =
        lang === "ru"
          ? `Подробно проанализируй изображение. Опиши: 1) Все объекты, элементы, цвета, стиль. 2) Что происходит на картинке / назначение объекта. 3) Качество и особенности исполнения.${userQuestionHint}`
          : lang === "zh"
            ? `详细分析图片。描述：1) 所有对象、元素、颜色、风格。2) 图片内容/用途。3) 执行质量和特点。${userQuestionHint}`
            : `Analyze the image in detail. Describe: 1) All objects, elements, colors, style. 2) What is happening / purpose of the object. 3) Quality and execution details.${userQuestionHint}`;
      visionText = await visionChatCompletion({
        baseUrl: ollamaConfig.baseUrl,
        model: modeModels.vision,
        prompt: visionPrompt,
        images,
        timeoutMs: ollamaConfig.visionTimeoutMs
      });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        if (ocrText) {
          // Есть OCR — работаем без vision
          visionText = "(объекты и сцена не распознаны — используй текст выше)";
        } else {
          if (msg.includes("Vision-модель") || msg.includes("ollama pull")) throw new Error(msg);
          if (msg.includes("aborted") || msg.includes("abort")) {
            throw new Error(
              "Таймаут распознавания картинки. Llava загружается долго — подождите и попробуйте снова. Убедитесь, что Ollama запущен."
            );
          }
          throw new Error(
            `Не удалось распознать картинку: ${msg}. Установите vision-модель: ollama pull llava`
          );
        }
      }
    } else {
      visionText = "(ocr-режим: распознавание текста качественное, vision пропущен)";
    }

    const parts: string[] = [];
    if (ocrText) parts.push(`[ТЕКСТ С КАРТИНКИ (OCR)]\n${ocrText}`);
    if (visionText) parts.push(`[ОПИСАНИЕ КАРТИНКИ]\n${visionText}`);
    if (parts.length > 0) imageContext = parts.join("\n\n---\n\n") + "\n\n---\n";
  }

  const isImageOnly = question === "[Изображение]" && imageContext.length > 0;
  const imageOnlyInstruction =
    getAnswerLang() === "ru"
      ? "Пользователь отправил изображение без текстового вопроса. На основе описания выше: " +
        "определи что это, оцени качество/стиль, предложи улучшения или объясни содержание."
      : getAnswerLang() === "zh"
        ? "用户发送了图片但没有文字问题。根据上述描述：确定内容，评价质量/风格，提出改进建议或说明内容。"
        : "User sent an image without a text question. Based on the description above: " +
          "identify what it is, evaluate quality/style, suggest improvements or explain the content.";
  const imageWithQuestionPrefix =
    imageContext && !isImageOnly
      ? (getAnswerLang() === "ru"
          ? "[ИЗОБРАЖЕНИЕ ПОЛЬЗОВАТЕЛЯ — ОПИСАНИЕ НИЖЕ]\nОтвечай на вопрос С УЧЁТОМ этого изображения:\n\n"
          : getAnswerLang() === "zh"
            ? "[用户图片——描述如下]\n结合图片回答问题：\n\n"
            : "[USER IMAGE — DESCRIPTION BELOW]\nAnswer the question TAKING INTO ACCOUNT this image:\n\n")
      : "";
  const questionLabel =
    getAnswerLang() === "ru" ? "Вопрос" : getAnswerLang() === "zh" ? "问题" : "Question";
  const langSuffix =
    getAnswerLang() === "ru"
      ? "\n\n[Ответ СТРОГО на русском.]"
      : getAnswerLang() === "zh"
        ? "\n\n[请严格使用中文回答。]"
        : "\n\n[Reply in English ONLY.]";
  const chatHistory = request.chatHistory ?? [];
  const chatHistoryLabel =
    getAnswerLang() === "ru"
      ? "[ПРЕДЫДУЩИЙ ДИАЛОГ — ТОЛЬКО КОНТЕКСТ]. НЕ копируй предыдущий ответ. Твой ответ — ТОЛЬКО на текущий вопрос ниже."
      : getAnswerLang() === "zh"
        ? "[上文对话—仅作参考]。不要复制上一回答。你的回答只针对下面的当前问题。"
        : "[PREVIOUS DIALOGUE — CONTEXT ONLY]. Do NOT copy the previous answer. Your answer is ONLY for the current question below.";
  const answerLabel = getAnswerLang() === "ru" ? "Ответ" : getAnswerLang() === "zh" ? "回答" : "Answer";
  const chatHistoryContext =
    chatHistory.length > 0
      ? chatHistoryLabel +
        "\n\n" +
        chatHistory
          .slice(-6)
          .map((h) => `${questionLabel}: ${h.question}\n${answerLabel}: ${h.answer}`)
          .join("\n\n---\n\n") +
        "\n\n---"
      : "";
  const currentQuestionBlock =
    getAnswerLang() === "ru"
      ? `[ТЕКУЩИЙ ВОПРОС — ОТВЕЧАЙ ТОЛЬКО НА НЕГО]\n${questionLabel}: ${question}`
      : getAnswerLang() === "zh"
        ? `[当前问题—只回答此问题]\n${questionLabel}: ${question}`
        : `[CURRENT QUESTION — ANSWER ONLY THIS]\n${questionLabel}: ${question}`;
  const noMetaSuffix =
    getAnswerLang() === "ru"
      ? "\n\n[ФОРМАТ] Пиши ТОЛЬКО сам ответ. ЗАПРЕЩЕНО выводить «[ПРЕДЫДУЩИЙ ДИАЛОГ]», «Вопрос:», «Ответ:» или другие метки — только суть."
      : getAnswerLang() === "zh"
        ? "\n\n[格式] 只写回答本身。禁止输出「[本聊天历史]」「问题：」「回答：」等标签。"
        : "\n\n[FORMAT] Output ONLY the answer. FORBIDDEN: «[PREVIOUS DIALOGUE]», «Question:», «Answer:» or other labels.";
  const userContent =
    imageWithQuestionPrefix +
    (imageContext || "") +
    (webContext ? `${webContext}\n\n---\n` : "") +
    (chatHistoryContext ? `${chatHistoryContext}\n\n` : "") +
    `${currentContext}\n\n` +
    (isImageOnly ? imageOnlyInstruction : currentQuestionBlock) +
    (chatHistoryContext ? noMetaSuffix : "") +
    langSuffix;

  const runAgent = async (
    agent: (typeof agentProfiles)[number]
  ): Promise<AgentAnswer> => {
    const start = performance.now();
    const model = agent.model;
    const timeoutMs = deepResearchMode
      ? ollamaConfig.deepResearchTimeoutMs
      : complexity === "simple"
        ? ollamaConfig.simpleTimeoutMs
        : ollamaConfig.timeoutMs;
    try {
      const rawContent = await chatCompletion({
        baseUrl: ollamaConfig.baseUrl,
        model,
        timeoutMs,
        temperature: agent.temperature ?? 0.3,
        topP: agent.topP ?? 0.9,
        numPredict: agent.numPredict,
        messages: [
          { role: "system", content: buildSystemPrompt(agent, imageContext) },
          { role: "user", content: userContent }
        ],
        onToken: onAgentToken ? (token) => onAgentToken(agent.id, token) : undefined,
        externalSignal: getAskSignal()
      });
      let content = await normalizeAnswerLanguage(rawContent, getAnswerLang(), model);
      const stripMetaBlock = (s: string): string => {
        let t = s.trim();
        const patterns = [
          /^\s*\[ПРЕДЫДУЩИЙ ДИАЛОГ[^\]]*\]\s*\n?/i,
          /^\s*\[PREVIOUS (?:CHAT )?HISTORY[^\]]*\]\s*\n?/i,
          /^\s*\[本聊天历史[^\]]*\]\s*\n?/,
          /^\s*(Вопрос|Question|问题):\s*[^\n]+\n\s*(Ответ|Answer|回答):\s*/i
        ];
        for (let i = 0; i < 5; i++) {
          const before = t;
          for (const p of patterns) t = t.replace(p, "");
          if (t === before) break;
        }
        return t.trim();
      };
      content = stripMetaBlock(content);
      const durationMs = Math.round(performance.now() - start);
      const answer: AgentAnswer = {
        id: agent.id,
        title: agent.title,
        content,
        model,
        durationMs
      };
      onAgentAnswer?.(answer);
      // #region agent log
      _dbg("orchestrator.ts:agentAnswer", "agent responded", {
        agentId: agent.id,
        model: agent.model,
        answerPreview: content.slice(0, 300),
        length: content.length,
        lines: content.split(/\r?\n/).length,
        roleAdherence: estimateRoleAdherence(agent.id, content),
        saysNoInfo: /не указано|нет точных данных|insufficient|not specified/i.test(content),
        hasTrump: /трамп|trump/i.test(content),
        hasBiden: /байден|biden/i.test(content)
      }, "H22");
      // #endregion
      return answer;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const isUserStop = getAskSignal()?.aborted && getAskSignal()?.reason === "user-stop";
      const fallbackModel = modeModels.imageFast || modeModels.aggregator || "llama3.1:8b";
      // #region agent log
      fetch("http://127.0.0.1:7242/ingest/4b0a4586-f145-45e3-a48e-f22e8cd2b4ec",{method:"POST",headers:{"Content-Type":"application/json","X-Debug-Session-Id":"9fc818"},body:JSON.stringify({sessionId:"9fc818",location:"main/orchestrator.ts:runAgent-catch",message:"agent failed",data:{agentId:agent.id,model,fallbackModel,isAbort:isAbortLikeError(message),skipFallback:model===fallbackModel,errMsg:message.slice(0,80)},hypothesisId:"H1,H3",timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      // Если пользователь нажал Stop — не делаем повторный запрос, возвращаем частичный ответ
      if (isUserStop) {
        const durationMs = Math.round(performance.now() - start);
        const lang = getAnswerLang();
        const stoppedMsg = lang === "ru"
          ? "⏹ Остановлено пользователем."
          : lang === "zh" ? "⏹ 已被用户停止。" : "⏹ Stopped by user.";
        const answer: AgentAnswer = {
          id: agent.id,
          title: agent.title,
          content: stoppedMsg,
          model,
          durationMs
        };
        onAgentAnswer?.(answer);
        return answer;
      }

      if (isAbortLikeError(message) && model !== fallbackModel) {
        try {
          const rawFallback = await chatCompletion({
            baseUrl: ollamaConfig.baseUrl,
            model: fallbackModel,
            timeoutMs: Math.min(35000, timeoutMs),
            temperature: 0.3,
            topP: 0.9,
            numPredict: Math.min(agent.numPredict ?? 120, 90),
            messages: [
              { role: "system", content: buildSystemPrompt(agent, imageContext) },
              { role: "user", content: userContent }
            ],
            externalSignal: getAskSignal()
          });
          const content = await normalizeAnswerLanguage(rawFallback, getAnswerLang(), fallbackModel);
          const durationMs = Math.round(performance.now() - start);
          const answer: AgentAnswer = {
            id: agent.id,
            title: agent.title,
            content,
            model: `${fallbackModel} (fallback)`,
            durationMs
          };
          onAgentAnswer?.(answer);
          return answer;
        } catch {
          // fallback тоже упал — попробуем минимальный запрос
        }
      }
      const minimalContent = await tryMinimalResponse(
        ollamaConfig.baseUrl,
        question,
        getAnswerLang()
      );
      const durationMs = Math.round(performance.now() - start);
      // #region agent log
      _dbg("orchestrator.ts:agentError", "agent failed", {
        agentId: agent.id,
        model,
        timeoutMs,
        message
      }, "H20");
      // #endregion
      const answer: AgentAnswer = {
        id: agent.id,
        title: agent.title,
        content:
          minimalContent ??
          buildHardFallback(agent.id, getAnswerLang(), question, forecastMode, deepResearchMode),
        model: minimalContent ? "llama3.1:8b (minimal)" : `${model} (hard-fallback)`,
        durationMs
      };
      onAgentAnswer?.(answer);
      return answer;
    }
  };

  const answers = (ollamaConfig.sequentialAgents || deepResearchMode)
    ? await runSequential(activeAgents, runAgent)
    : await runWithConcurrency(activeAgents, runAgent, ollamaConfig.agentConcurrency);

  const isGreetingOrJunk = (s: string): boolean => {
    const t = s.trim().replace(/[!?.]+$/, "").toLowerCase();
    return t.length < 35 && /^(привет|ку|здарова|здравствуй|хай|hello|hi|hey|你好|嗨)\s*$/i.test(t);
  };
  const REFUSAL_PHRASES = /не могу ответить|не могу сформировать ответ|без конкретики|задайте более точный|переформулировать вопрос|cannot answer|can'?t answer|отказаться|i cannot answer|я не могу ответить|нет информации о том|в источниках не указано|в найденных источниках не указано|no information (?:about|on)|not (?:found|specified) in (?:the )?sources/i;
  const GREETING_ECHO = /^(ку|привет|ку,|привет,|здарова|хай|hello|hi)\s*,?\s*/i;
  const isRefusalAnswer = (s: string): boolean => REFUSAL_PHRASES.test(s);
  const isGreetingEchoRefusal = (s: string): boolean =>
    GREETING_ECHO.test(s.trim()) && isRefusalAnswer(s);
  const isGarbledText = (s: string): boolean => {
    const words = s.split(/\s+/);
    for (const w of words) {
      const clean = w.replace(/[!?.…,:;]+$/, "");
      if (clean.length < 2) continue;
      const hasCyr = /[а-яёА-ЯЁ]/.test(clean);
      const hasLat = /[a-zA-Z]/.test(clean);
      const hasDigit = /\d/.test(clean);
      if (hasCyr && hasLat) return true;
      if (hasDigit && hasCyr) return true;
    }
    return false;
  };
  const NONSENSE_BLACKLIST = ["здарва", "3дарва"];
  const isNonsenseAnswer = (s: string): boolean => {
    const t = s.trim().toLowerCase().replace(/[.!?,;]+$/, "");
    if (t.length > 50) return false;
    const firstWord = (t.split(/\s+/)[0] ?? "").replace(/[.!?,;]+$/, "");
    return NONSENSE_BLACKLIST.some((bad) => t === bad || firstWord === bad);
  };
  const isRepeatOfPrevious = (content: string): boolean => {
    const last = chatHistory[chatHistory.length - 1]?.answer;
    if (!last || content.length < 15) return false;
    const n = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const a = n(content);
    const b = n(last);
    if (a.length < 20) return false;
    const a80 = a.slice(0, 80);
    const b80 = b.slice(0, 80);
    if (a80 === b80) return true;
    if (a.length > 25 && b.length > 25) {
      const overlap = Math.min(a.length, b.length, 60);
      const aStart = a.slice(0, overlap);
      const bStart = b.slice(0, overlap);
      if (aStart === bStart) return true;
      if (a.includes(b80) || b.includes(a80)) return true;
    }
    return a === b || (a.length > 30 && b.includes(a)) || (b.length > 30 && a.includes(b));
  };
  const greetingFallback = (lang: "ru" | "en" | "zh"): string =>
    lang === "ru"
      ? "По контексту диалога — см. ответы выше."
      : lang === "zh"
        ? "根据对话上下文，请参阅上述回答。"
        : "See answers above for context.";
  const badAnswerFallback = (lang: "ru" | "en" | "zh"): string =>
    lang === "ru"
      ? "Не удалось сформировать ответ. Попробуйте переформулировать вопрос."
      : lang === "zh"
        ? "无法生成回答。请尝试重新表述问题。"
        : "Could not generate answer. Try rephrasing your question.";
  const sanitizedAnswers = answers.map((a) => {
    if (a.content.startsWith("Agent error:")) {
      return {
        ...a,
        content: buildHardFallback(a.id, getAnswerLang(), question, forecastMode, deepResearchMode),
        model: `${a.model} (sanitized)`
      };
    }
    if (isGreetingOrJunk(a.content)) {
      return { ...a, content: badAnswerFallback(getAnswerLang()), model: `${a.model} (greeting-filtered)` };
    }
    if (isGreetingEchoRefusal(a.content)) {
      return { ...a, content: greetingFallback(getAnswerLang()), model: `${a.model} (echo-refusal-filtered)` };
    }
    if (isRefusalAnswer(a.content)) {
      const fallback = buildHardFallback(a.id, getAnswerLang(), question, forecastMode, deepResearchMode);
      return { ...a, content: fallback, model: `${a.model} (refusal-filtered)` };
    }
    if (isGarbledText(a.content)) {
      return { ...a, content: badAnswerFallback(getAnswerLang()), model: `${a.model} (garbled-filtered)` };
    }
    if (isNonsenseAnswer(a.content)) {
      return { ...a, content: badAnswerFallback(getAnswerLang()), model: `${a.model} (nonsense-filtered)` };
    }
    if (isRepeatOfPrevious(a.content)) {
      const fallback = buildHardFallback(a.id, getAnswerLang(), question, forecastMode, deepResearchMode);
      return { ...a, content: fallback, model: `${a.model} (repeat-filtered)` };
    }
    return a;
  });

  // Если пользователь нажал Stop — пропускаем judge, возвращаем лучший частичный ответ
  if (getAskSignal()?.aborted && getAskSignal()?.reason === "user-stop") {
    const lang = getAnswerLang();
    const note = lang === "ru"
      ? "⏹ Генерация остановлена пользователем. Показаны ответы, полученные к моменту остановки."
      : lang === "zh"
        ? "⏹ 用户停止了生成。显示停止时已收到的回答。"
        : "⏹ Generation stopped by user. Showing answers received before stopping.";
    const bestAnswer = sanitizedAnswers.find(
      (a) => !a.content.startsWith("⏹") && a.content.length > 20
    ) ?? sanitizedAnswers[0];
    return {
      answers: sanitizedAnswers,
      final: {
        content: note + (bestAnswer ? `\n\n---\n\n${bestAnswer.content}` : ""),
        model: bestAnswer?.model ?? "—",
        durationMs: 0
      }
    };
  }

  const aggStart = performance.now();

  if (activeAgents.length === 1) {
    const single = sanitizedAnswers[0];
    return {
      answers: sanitizedAnswers,
      final: {
        content: single.content,
        model: single.model,
        durationMs: Math.round(performance.now() - aggStart)
      },
      ...(webSources.length > 0 && { webSources: { query: question, results: webSources } })
    };
  }

  // Anti-hallucination & language lock + smart synthesis — updated March 2026
  const judgeLang = getAnswerLang();
  const judgeLanguageInstruction = getLanguageInstruction(judgeLang);
  const judgeModeHint = isFactualMode
    ? "CRITICAL: SOURCES block below. Your answer MUST be 100% from sources. " +
      "REJECT any agent claim NOT in sources — it is fabricated. If no source has the answer — write ONLY «В найденных источниках не указано.» No guessing. "
    : forecastMode
      ? "For forecasts you may pick reasonable assumptions from the 4 answers. " +
        "If agents refused or sources are empty — use your knowledge, give a forecast, mark «по моим знаниям». NEVER refuse."
      : "";
  const aggSystem =
    SYSTEM_PREFIX +
    "\n\n" +
    prompts.judgeBase +
    judgeLanguageInstruction +
    "\n\n" +
    judgeModeHint;

  const aggBase = buildAggregationInput(question, sanitizedAnswers, webContext);
  const aggLangSuffix =
    judgeLang === "ru"
      ? "\n\n[Итоговый ответ СТРОГО на русском.]"
      : judgeLang === "zh"
        ? "\n\n[最终回答请严格使用中文。]"
        : "\n\n[Your synthesized answer MUST be in English ONLY.]";
  const aggUserContent = aggBase + aggLangSuffix;

  try {
    const judgeResponse = await chatCompletion({
      baseUrl: ollamaConfig.baseUrl,
      model: deepResearchMode
        ? modeModels.deepResearch
        : (hasInputImages ? modeModels.imageFast : modeModels.aggregator),
      timeoutMs: deepResearchMode ? ollamaConfig.deepResearchTimeoutMs : ollamaConfig.timeoutMs,
      temperature: 0.3,
      topP: 0.9,
      numPredict: 320,
      messages: [
        { role: "system", content: aggSystem },
        { role: "user", content: aggUserContent }
      ]
    });

    let synthesizedContent = fixCommonNonsense(judgeResponse.trim(), judgeLang);
    const finalDuration = Math.round(performance.now() - aggStart);
    const fallbackWinner = sanitizedAnswers.find((a) => !a.content.startsWith("Agent error:")) ?? sanitizedAnswers[0];
    if (isGreetingOrJunk(synthesizedContent)) {
      synthesizedContent = fallbackWinner ? fallbackWinner.content : badAnswerFallback(judgeLang);
    } else if (isGreetingEchoRefusal(synthesizedContent)) {
      synthesizedContent = greetingFallback(judgeLang);
    } else if (isRefusalAnswer(synthesizedContent) || isGarbledText(synthesizedContent) || isNonsenseAnswer(synthesizedContent) || isRepeatOfPrevious(synthesizedContent)) {
      synthesizedContent = fallbackWinner ? fallbackWinner.content : badAnswerFallback(judgeLang);
    }

    const response: AskResponse = {
      answers: sanitizedAnswers,
      final: {
        content: synthesizedContent || (fallbackWinner ? `---\n\n${fallbackWinner.content}` : "No synthesis available."),
        model: deepResearchMode ? modeModels.deepResearch : (hasInputImages ? modeModels.imageFast : modeModels.aggregator),
        durationMs: finalDuration
      }
    };
    if (webSources.length > 0) {
      response.webSources = { query: question, results: webSources };
    }
    return response;
  } catch (error) {
    const finalDuration = Math.round(performance.now() - aggStart);
    const fallback = sanitizedAnswers.find((a) => !a.content.startsWith("Agent error:"));
    const resp: AskResponse = {
      answers: sanitizedAnswers,
      final: {
        content: fallback
          ? `🏆 **Winner: ${fallback.title}** (model: ${fallback.model})\n\n---\n\n${fallback.content}`
          : "Judge could not pick a winner. Check Ollama availability.",
        model: fallback?.model ?? (hasInputImages ? modeModels.imageFast : modeModels.aggregator),
        durationMs: finalDuration
      }
    };
    if (webSources.length > 0) {
      resp.webSources = { query: question, results: webSources };
    }
    return resp;
  }
}

function parseWinnerId(judgeResponse: string): AgentId {
  const m = judgeResponse.match(
    /(?:WINNER|ПОБЕДИТЕЛЬ):\s*(planner|critic|pragmatist|explainer)/i
  );
  if (m) return m[1].toLowerCase() as AgentId;
  const byName: Record<string, AgentId> = {
    strategist: "planner",
    skeptic: "critic",
    practitioner: "pragmatist",
    explainer: "explainer",
    планировщик: "planner",
    критик: "critic",
    практик: "pragmatist",
    объяснитель: "explainer"
  };
  const lower = judgeResponse.toLowerCase();
  for (const [name, id] of Object.entries(byName)) {
    if (lower.includes(name)) return id;
  }
  return "planner";
}

function parseWinnerReason(judgeResponse: string): string {
  const m = judgeResponse.match(/(?:REASON|ПРИЧИНА):\s*(.+?)(?:\n|$)/is);
  return m?.[1]?.trim() ?? "";
}

function buildAggregationInput(
  question: string,
  answers: AgentAnswer[],
  webContext?: string
): string {
  const formatted = answers
    .map((answer) => {
      const isError = answer.content.startsWith("Agent error:");
      return `### ${answer.title} (model: ${answer.model})${isError ? " — ERROR, skip" : ""}\n${answer.content}`;
    })
    .join("\n\n");

  const sourcesBlock =
    webContext && webContext.length > 0
      ? `\n\n=== SOURCES (verify answers against these, reject fabrications) ===\n${webContext}\n`
      : "";
  return `Question:\n${question}\n\nAgent answers:\n${formatted}${sourcesBlock}`;
}
