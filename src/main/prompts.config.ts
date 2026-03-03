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
    numPredict: 120,
    systemPrompt: DEFAULT_BASE + "\n\n[РОЛЬ: Планировщик] Дай краткий план, 2–3 пункта."
  },
  {
    id: "critic",
    title: "Критик",
    model: ollamaConfig.agents.critic,
    numPredict: 100,
    systemPrompt: DEFAULT_BASE + "\n\n[РОЛЬ: Критик] Проверь факты, 1–2 замечания."
  },
  {
    id: "pragmatist",
    title: "Практик",
    model: ollamaConfig.agents.pragmatist,
    numPredict: 100,
    systemPrompt: DEFAULT_BASE + "\n\n[РОЛЬ: Практик] Дай прикладной ответ кратко."
  },
  {
    id: "explainer",
    title: "Объяснитель",
    model: ollamaConfig.agents.explainer,
    numPredict: 80,
    temperature: 0.3,
    systemPrompt: DEFAULT_BASE + "\n\n[РОЛЬ: Объяснитель] Объясни в 1–2 предложениях."
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
