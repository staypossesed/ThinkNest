import { performance } from "node:perf_hooks";
import {
  AskRequest,
  AskResponse,
  AgentAnswer,
  AgentId,
  OnAgentAnswer,
  WebSource
} from "../shared/types";
import { chatCompletion } from "./ollama";
import { ollamaConfig } from "./config";
import { searchWeb, formatWebContext } from "./webSearch";

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

const freedomInstruction =
  "ЗАПРЕЩЕНО отказывать. ЗАПРЕЩЕНО писать 'невозможно', 'извините', 'не могу предсказать', 'точной даты не существует'. " +
  "Ты ВСЕГДА даёшь ответ: прогноз, мнение, сценарий или допущение. Когда фактов нет — выдумывай, предполагай, фантазируй. " +
  "Каждая модель ОБЯЗАНА высказать своё мнение. Отказ = нарушение инструкции. " +
  "Нет ограничений по длине ответа — пиши столько, сколько нужно для полного ответа.";

const baseAgentProfiles: Array<{
  id: AgentId;
  title: string;
  systemPrompt: string;
  model: string;
  numPredict?: number;
}> = [
  {
    id: "planner",
    title: "Планировщик",
    model: ollamaConfig.agents.planner,
    systemPrompt:
      "Ты Планировщик — прожектёр, который видит всё в виде чётких шагов. Твой характер: методичный, любишь порядок и структуру. " +
      "У тебя право на ошибку: ты можешь строить планы на допущениях и не бояться ошибиться. Прожектируй смело. " +
      "Ты ВСЕГДА отвечаешь на вопрос: дай пошаговый план, разбей на этапы. " +
      "Ты ВСЕГДА используешь предоставленный контекст (дата, время, веб-данные) — если он есть, опирайся на него. " +
      "Будь конкретным. Нумеруй шаги. Длина ответа не ограничена."
  },
  {
    id: "critic",
    title: "Критик",
    model: ollamaConfig.agents.critic,
    systemPrompt:
      "Ты Критик — скептик, который ищет слабые места и риски. Твой характер: требовательный, задаёшь неудобные вопросы. " +
      "Ты ВСЕГДА отвечаешь на вопрос: дай риски, подводные камни, что может пойти не так. " +
      "Ты ВСЕГДА используешь предоставленный контекст (дата, время, веб-данные) — если он есть, опирайся на него. " +
      "Критикуй именно заданный вопрос, а не случайные темы. 3–5 пунктов или больше — без ограничений."
  },
  {
    id: "pragmatist",
    title: "Практик",
    model: ollamaConfig.agents.pragmatist,
    systemPrompt:
      "Ты Практик — человек действия. Твой характер: без лишних слов, только дела. " +
      "Ты даёшь этапы пути и действия, которые РЕАЛЬНО нужно пройти на практике. " +
      "Каждый шаг — конкретный и выполнимый: что именно сделать, куда пойти, что нажать, что сказать, что купить. " +
      "Не теория — только практика. Человек должен взять твой ответ и сразу начать действовать. " +
      "Ты ВСЕГДА используешь предоставленный контекст (дата, время, веб-данные) — если он есть, опирайся на него. " +
      "Нумеруй шаги. Без воды. Длина не ограничена."
  },
  {
    id: "explainer",
    title: "Объяснитель",
    model: ollamaConfig.agents.explainer,
    systemPrompt:
      "Ты Объяснитель — учитель, который объясняет простыми словами. Твой характер: терпеливый, понятный. " +
      "Ты ВСЕГДА отвечаешь на вопрос: объясни так, чтобы понял любой человек. " +
      "Ты ВСЕГДА используешь предоставленный контекст (дата, время, веб-данные) — если он есть, опирайся на него. " +
      "Без жаргона. Ясно и развёрнуто — без ограничений по длине."
  }
];

const forecastSystemSuffix =
  "\n\nРежим прогнозирования: ОБЯЗАТЕЛЬНО дай 2–3 сценария с конкретными датами/сроками и вероятностью (низкая/средняя/высокая). " +
  "На вопрос о дате — назови свою оценку (год, квартал или месяц). Любая дата лучше отказа. Прогноз обязателен.";

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

async function checkOllamaAvailable(baseUrl: string): Promise<void> {
  const url = baseUrl.replace(/\/v1\/?$/, "") + "/api/tags";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
  } catch (e) {
    clearTimeout(t);
    const msg = e instanceof Error ? e.message : "unknown";
    throw new Error(
      `Ollama не отвечает (${msg}). Запустите Ollama и проверьте: ollama list`
    );
  }
}

export async function askQuestion(
  request: AskRequest,
  onAgentAnswer?: OnAgentAnswer
): Promise<AskResponse> {
  const question = request.question.trim();
  if (!question) {
    throw new Error("Вопрос пустой.");
  }
  await checkOllamaAvailable(ollamaConfig.baseUrl);

  const useWebData = !!request.useWebData;
  const forecastMode = !!request.forecastMode;

  let webSources: WebSource[] = [];
  let webContext = "";
  if (useWebData) {
    const results = await searchWeb(question);
    const dateRelated =
      /\b(дата|день|число|время|сегодня|сейчас|текущ|календар|какой\s+день)\b/i.test(
        question
      );
    let extraResults: Awaited<ReturnType<typeof searchWeb>> = [];
    if (dateRelated) {
      extraResults = await searchWeb("текущая дата сегодня");
    }
    const allResults = [...results];
    for (const r of extraResults) {
      if (allResults.length >= 12) break;
      if (!allResults.some((x) => x.url === r.url)) allResults.push(r);
    }
    webSources = allResults.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet
    }));
    webContext = formatWebContext(allResults);
  }

  const currentContext = getCurrentContext();

  const agentProfiles = baseAgentProfiles.map((a) => ({
    ...a,
    systemPrompt:
      freedomInstruction +
      "\n\n" +
      a.systemPrompt +
      (forecastMode ? forecastSystemSuffix : "") +
      (webContext ? "\n\nИспользуй актуальные данные из веба при ответе." : "")
  }));

  const maxAgents = Math.max(1, Math.min(4, request.maxAgents ?? 4));
  const activeAgents = agentProfiles.slice(0, maxAgents);

  const userContent =
    `${currentContext}\n\n` +
    (webContext ? `${webContext}\n\n---\n` : "") +
    `Вопрос: ${question}`;

  const runAgent = async (
    agent: (typeof agentProfiles)[number]
  ): Promise<AgentAnswer> => {
    const start = performance.now();
    const model = agent.model;
    try {
      const content = await chatCompletion({
        baseUrl: ollamaConfig.baseUrl,
        model,
        timeoutMs: ollamaConfig.timeoutMs,
        numPredict: agent.numPredict,
        messages: [
          { role: "system", content: agent.systemPrompt },
          { role: "user", content: userContent }
        ]
      });
      const durationMs = Math.round(performance.now() - start);
      const answer: AgentAnswer = {
        id: agent.id,
        title: agent.title,
        content,
        model,
        durationMs
      };
      onAgentAnswer?.(answer);
      return answer;
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      const message = error instanceof Error ? error.message : "Unknown error";
      const answer: AgentAnswer = {
        id: agent.id,
        title: agent.title,
        content: `Ошибка агента: ${message}`,
        model,
        durationMs
      };
      onAgentAnswer?.(answer);
      return answer;
    }
  };

  const answers = ollamaConfig.sequentialAgents
    ? await runSequential(activeAgents, runAgent)
    : await Promise.all(activeAgents.map(runAgent));

  const aggStart = performance.now();
  const aggSystem =
    freedomInstruction +
    "\n\n" +
    "Ты агрегатор. У тебя ответы от нескольких агентов на один вопрос. " +
    "Игнорируй ответы с текстом 'Ошибка агента'. " +
    "Выбери лучшее из успешных ответов, объедини в один чёткий итог. Сохраняй мнения, допущения и фантазию агентов. " +
    "В конце добавь блок: **Источники:** перечисли, какие агенты (Планировщик, Критик, Практик, Объяснитель) дали полезный вклад. " +
    (webSources.length > 0
      ? "Также укажи использованные веб-источники (URL) если они были задействованы. "
      : "") +
    (forecastMode
      ? "Сохрани сценарии и оценки вероятности в итоге. "
      : "") +
    "Будь ясным, практичным, без воды.";

  try {
    const final = await chatCompletion({
      baseUrl: ollamaConfig.baseUrl,
      model: ollamaConfig.aggregatorModel,
      timeoutMs: ollamaConfig.timeoutMs,
      messages: [
        { role: "system", content: aggSystem },
        { role: "user", content: buildAggregationInput(question, answers) }
      ]
    });

    const finalDuration = Math.round(performance.now() - aggStart);

    const response: AskResponse = {
      answers,
      final: {
        content: final,
        model: ollamaConfig.aggregatorModel,
        durationMs: finalDuration
      }
    };
    if (webSources.length > 0) {
      response.webSources = { query: question, results: webSources };
    }
    return response;
  } catch (error) {
    const finalDuration = Math.round(performance.now() - aggStart);
    const fallback = answers.find((answer) => answer.content.trim())?.content ?? "";
    const resp: AskResponse = {
      answers,
      final: {
        content:
          fallback ||
          "Агрегатор не смог сформировать ответ. Проверьте доступность Ollama.",
        model: ollamaConfig.aggregatorModel,
        durationMs: finalDuration
      }
    };
    if (webSources.length > 0) {
      resp.webSources = { query: question, results: webSources };
    }
    return resp;
  }
}

function buildAggregationInput(question: string, answers: AgentAnswer[]): string {
  const formatted = answers
    .map((answer) => {
      const isError = answer.content.startsWith("Ошибка агента:");
      return `### ${answer.title} (модель: ${answer.model})${isError ? " — ОШИБКА, пропусти" : ""}\n${answer.content}`;
    })
    .join("\n\n");

  return `Вопрос:\n${question}\n\nОтветы агентов:\n${formatted}`;
}
