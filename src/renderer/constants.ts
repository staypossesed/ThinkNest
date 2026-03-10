import type { AgentId } from "../shared/types";

/** English display names + emoji + accent color for UI */
export const AGENT_DISPLAY: Record<AgentId, { name: string; emoji: string; color: string }> = {
  planner: { name: "Strategist", emoji: "🎯", color: "blue" },
  critic: { name: "Skeptic", emoji: "🔍", color: "orange" },
  pragmatist: { name: "Practitioner", emoji: "⚡", color: "green" },
  explainer: { name: "Explainer", emoji: "💡", color: "purple" },
};
