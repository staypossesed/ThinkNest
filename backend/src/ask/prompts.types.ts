import type { AgentId } from "./types";

export interface AgentPromptConfig {
  id: AgentId;
  title: string;
  systemPrompt: string;
  model: string;
  numPredict?: number;
  temperature?: number;
}

export interface PromptsConfig {
  basePrompt: string;
  agents: AgentPromptConfig[];
  forecastSuffix: string;
  judgeBase: string;
}
