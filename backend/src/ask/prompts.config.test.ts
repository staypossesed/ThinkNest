import { describe, it, expect } from "vitest";
import { getPrompts } from "./prompts.config";

describe("backend prompts.config", () => {
  it("returns TRUTHFUL_FAST_PROMPT base with never-refuse instruction", () => {
    const p = getPrompts();
    expect(p.basePrompt).toContain("ГЛАВНОЕ: ОБЯЗАТЕЛЬНО отвечай на вопрос");
    expect(p.basePrompt).toContain("Никогда не отказывайся");
    expect(p.basePrompt).toContain("не задавай уточняющих вопросов");
  });

  it("has 4 agents with Russian titles matching prompts.private", () => {
    const p = getPrompts();
    expect(p.agents).toHaveLength(4);
    const titles = p.agents.map((a) => a.title);
    expect(titles).toEqual(["Планировщик", "Критик", "Практик", "Объяснитель"]);
  });

  it("each agent has TRUTHFUL_FAST_PROMPT and role-specific instructions", () => {
    const p = getPrompts();
    for (const a of p.agents) {
      expect(a.systemPrompt).toContain("ГЛАВНОЕ: ОБЯЗАТЕЛЬНО отвечай");
      expect(a.systemPrompt).toContain("[РОЛЬ:");
    }
  });

  it("explainer has language and typo-fix instructions", () => {
    const p = getPrompts();
    const explainer = p.agents.find((a) => a.id === "explainer");
    expect(explainer).toBeDefined();
    expect(explainer!.systemPrompt).toContain("Пиши ТОЛЬКО на языке вопроса");
    expect(explainer!.systemPrompt).toContain("беспечность");
  });

  it("critic has explicit never-refuse instruction", () => {
    const p = getPrompts();
    const critic = p.agents.find((a) => a.id === "critic");
    expect(critic).toBeDefined();
    expect(critic!.systemPrompt).toContain("ОБЯЗАТЕЛЬНО дай вердикт");
    expect(critic!.systemPrompt).toContain("не отказывайся");
  });

  it("numPredict matches prompts.private (320, 260, 220, 180)", () => {
    const p = getPrompts();
    const nums = p.agents.map((a) => a.numPredict);
    expect(nums).toEqual([320, 260, 220, 180]);
  });

  it("forecastSuffix requires scenarios with dates", () => {
    const p = getPrompts();
    expect(p.forecastSuffix).toContain("ОБЯЗАТЕЛЬНО дай");
    expect(p.forecastSuffix).toContain("датами/сроками");
  });
});
