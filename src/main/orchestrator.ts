import { performance } from "node:perf_hooks";
import { AskRequest, AskResponse, AgentAnswer, AgentId, OnAgentAnswer } from "../shared/types";
import { chatCompletion } from "./ollama";
import { ollamaConfig } from "./config";

const agentProfiles: Array<{
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
      "Ты планировщик. Дай свою точку зрения: пошаговый план. Будь структурирован и лаконичен."
  },
  {
    id: "critic",
    title: "Критик",
    model: ollamaConfig.agents.critic,
    numPredict: 400,
    systemPrompt:
      "Ты критик. Дай свою точку зрения: риски, слабые места, подводные камни. Кратко, 3–5 пунктов."
  },
  {
    id: "pragmatist",
    title: "Практик",
    model: ollamaConfig.agents.pragmatist,
    systemPrompt:
      "Ты практик. Дай свою точку зрения: применимые шаги, что делать прямо сейчас. Без воды."
  },
  {
    id: "explainer",
    title: "Объяснитель",
    model: ollamaConfig.agents.explainer,
    systemPrompt:
      "Ты объяснитель. Дай свою точку зрения: объясни простыми словами, чтобы было понятно любому."
  }
];

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

  const maxAgents = Math.max(1, Math.min(4, request.maxAgents ?? 4));
  const activeAgents = agentProfiles.slice(0, maxAgents);

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
          { role: "user", content: question }
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
  try {
    const final = await chatCompletion({
      baseUrl: ollamaConfig.baseUrl,
      model: ollamaConfig.aggregatorModel,
      timeoutMs: ollamaConfig.timeoutMs,
      messages: [
        {
          role: "system",
          content:
            "Ты агрегатор. У тебя ответы от нескольких агентов на один вопрос. " +
            "Игнорируй ответы с текстом 'Ошибка агента'. " +
            "Выбери лучшее из успешных ответов, объедини в один чёткий итог. " +
            "В конце добавь блок: **Источники:** перечисли, какие агенты (Планировщик, Критик, Практик, Объяснитель) дали полезный вклад. " +
            "Будь ясным, практичным, без воды."
        },
        {
          role: "user",
          content: buildAggregationInput(question, answers)
        }
      ]
    });

    const finalDuration = Math.round(performance.now() - aggStart);

    return {
      answers,
      final: {
        content: final,
        model: ollamaConfig.aggregatorModel,
        durationMs: finalDuration
      }
    };
  } catch (error) {
    const finalDuration = Math.round(performance.now() - aggStart);
    const fallback = answers.find((answer) => answer.content.trim())?.content ?? "";
    return {
      answers,
      final: {
        content:
          fallback ||
          "Агрегатор не смог сформировать ответ. Проверьте доступность Ollama.",
        model: ollamaConfig.aggregatorModel,
        durationMs: finalDuration
      }
    };
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
