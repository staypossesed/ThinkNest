/**
 * Пример структуры prompts.private.ts
 * Скопируй в prompts.private.ts и заполни своими промптами.
 * prompts.private.ts в .gitignore — не коммитится.
 */
import type { PromptsConfig } from "./prompts.types";
import { ollamaConfig } from "./config";

const prompts: PromptsConfig = {
  basePrompt: "Твой базовый промпт для всех агентов...",
  agents: [
    {
      id: "planner",
      title: "Планировщик",
      model: ollamaConfig.agents.planner,
      numPredict: 320,
      systemPrompt: "Базовый промпт + [РОЛЬ: Планировщик] ..."
    },
    {
      id: "critic",
      title: "Критик",
      model: ollamaConfig.agents.critic,
      numPredict: 260,
      systemPrompt: "Базовый промпт + [РОЛЬ: Критик] ..."
    },
    {
      id: "pragmatist",
      title: "Практик",
      model: ollamaConfig.agents.pragmatist,
      numPredict: 220,
      systemPrompt: "Базовый промпт + [РОЛЬ: Практик] ..."
    },
    {
      id: "explainer",
      title: "Объяснитель",
      model: ollamaConfig.agents.explainer,
      numPredict: 180,
      temperature: 0.3,
      systemPrompt: "Базовый промпт + [РОЛЬ: Объяснитель] ..."
    }
  ],
  forecastSuffix: "\n\nРежим прогноза: ...",
  judgeBase: "Ты судья. Выбери лучший ответ..."
};

export default prompts;
