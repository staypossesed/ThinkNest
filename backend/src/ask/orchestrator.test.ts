import { describe, it, expect } from "vitest";

// Read orchestrator source to verify SYSTEM_PREFIX and language instructions (avoid importing full deps)
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("backend orchestrator", () => {
  const src = readFileSync(join(__dirname, "orchestrator.ts"), "utf-8");

  it("contains never-refuse instruction for web parity", () => {
    expect(src).toContain("ЗАПРЕЩЕНО отказываться");
    expect(src).toContain("вопрос слишком расплывчатый");
    expect(src).toContain("Даже на общие");
  });

  it("injects getLanguageInstruction into buildSystemPrompt (answer language = question language)", () => {
    expect(src).toContain("getLanguageInstruction(lang)");
    expect(src).toContain("English ONLY");
    expect(src).toContain("FORBIDDEN");
  });
});
