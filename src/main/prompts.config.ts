import type { AgentId } from "../shared/types";
import type { AgentPromptConfig, PromptsConfig } from "./prompts.types";
import { ollamaConfig } from "./config";

/** Минимальные промпты по умолчанию (публичный репо). Полные — в prompts.private.ts (gitignore). */
const DEFAULT_BASE =
  "Ты ассистент. Отвечай на вопрос. Не отказывайся. Будь полезен и краток. Отвечай на языке вопроса.";

const DEFAULT_AGENTS: AgentPromptConfig[] = [
  {
    id: "planner",
    title: "Планировщик",
    model: ollamaConfig.agents.planner,
    numPredict: 140,
    temperature: 0.7,
    systemPrompt:
      DEFAULT_BASE +
      "\n\n[РОЛЬ: Планировщик] Ты структурируешь ответ. Дай чёткий план: шаги, приоритеты, последовательность. " +
      "Фокус на логике и порядке. Не повторяй то, что скажут другие — твоя задача именно структура и разбивка на этапы."
  },
  {
    id: "critic",
    title: "Критик",
    model: ollamaConfig.agents.critic,
    numPredict: 120,
    temperature: 0.65,
    systemPrompt:
      DEFAULT_BASE +
      "\n\n[РОЛЬ: Критик] Ты скептик. Найди риски, неточности, слабые места. " +
      "Оспорь излишне оптимистичные выводы. Укажи, что может пойти не так. Не дублируй позитивные ответы — твоя задача именно критика и проверка."
  },
  {
    id: "pragmatist",
    title: "Практик",
    model: ollamaConfig.agents.pragmatist,
    numPredict: 120,
    temperature: 0.6,
    systemPrompt:
      DEFAULT_BASE +
      "\n\n[РОЛЬ: Практик] Ты про конкретные действия. Что делать прямо сейчас, какие шаги, чек-лист. " +
      "Фокус на применимости и реализме. Не теоретизируй — дай практичный, приземлённый ответ."
  },
  {
    id: "explainer",
    title: "Объяснитель",
    model: ollamaConfig.agents.explainer,
    numPredict: 100,
    temperature: 0.75,
    systemPrompt:
      DEFAULT_BASE +
      "\n\n[РОЛЬ: Объяснитель] Ты упрощаешь и разъясняешь. Объясни суть простыми словами, аналогиями, примерами. " +
      "Фокус на ясности для неспециалиста. Не копируй формальные ответы — дай своё понятное объяснение."
  }
];

const DEFAULT_FORECAST =
  "\n\nРежим прогноза: дай 3 сценария (бычий/базовый/медвежий) с диапазоном значений, вероятностями и горизонтом. " +
  "Укажи драйверы: макроэкономика, политика/регуляторика, геополитика, поведение крупных игроков, " +
  "новостной фон, соцмедиа/инфлюенсеры, технологические события. Заверши чеклистом мониторинга.";

const DEFAULT_JUDGE =
  "Ты судья. Выбери лучший ответ из 4. Формат: ПОБЕДИТЕЛЬ: [agent]\nПРИЧИНА: [почему]";

let cached: PromptsConfig | null = null;

function loadPrivatePrompts(): PromptsConfig | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("./prompts.private");
    const p = m.default ?? m.prompts;
    if (p && typeof p === "object" && Array.isArray(p.agents)) {
      return p as PromptsConfig;
    }
  } catch {
    /* prompts.private.ts не найден — используем defaults */
  }
  return null;
}

export function getPrompts(): PromptsConfig {
  if (cached) return cached;
  const privatePrompts = loadPrivatePrompts();
  cached = privatePrompts ?? {
    basePrompt: DEFAULT_BASE,
    agents: DEFAULT_AGENTS,
    forecastSuffix: DEFAULT_FORECAST,
    judgeBase: DEFAULT_JUDGE
  };
  return cached;
}
