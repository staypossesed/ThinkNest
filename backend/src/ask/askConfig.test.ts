import { describe, it, expect } from "vitest";
import { getModelsForMode, MODE_MODELS } from "./askConfig";

describe("backend askConfig", () => {
  it("all modes use llama3.2:3b for planner, explainer, aggregator, imageFast", () => {
    for (const mode of ["fast", "balanced", "quality"] as const) {
      const m = MODE_MODELS[mode];
      expect(m.planner).toBe("llama3.2:3b");
      expect(m.explainer).toBe("llama3.2:3b");
      expect(m.aggregator).toBe("llama3.2:3b");
      expect(m.imageFast).toBe("llama3.2:3b");
    }
  });

  it("getModelsForMode returns balanced by default", () => {
    const m = getModelsForMode();
    expect(m).toEqual(MODE_MODELS.balanced);
  });

  it("no phi3 or phi4 models (replaced with llama3.2:3b)", () => {
    for (const mode of ["fast", "balanced", "quality"] as const) {
      const m = MODE_MODELS[mode];
      const str = JSON.stringify(m);
      expect(str).not.toMatch(/phi3|phi4/);
    }
  });
});
