import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentAnswer } from "../../shared/types";
import type { UiLocale } from "./LanguageSelector";
import { t } from "../i18n";

const agentColors: Record<string, string> = {
  planner: "var(--agent-planner)",
  critic: "var(--agent-critic)",
  pragmatist: "var(--agent-pragmatist)",
  explainer: "var(--agent-explainer)"
};

function getVerdictPreview(content: string, maxLen = 100): string {
  const verdictMatch = content.match(/Вердикт:\s*(.+?)(?:\n|$)/i);
  if (verdictMatch) {
    const t = verdictMatch[1].trim();
    return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
  }
  const first = content.split("\n")[0]?.trim() ?? "";
  return first.length <= maxLen ? first : first.slice(0, maxLen) + "…";
}

interface AgentCardProps {
  answer: AgentAnswer;
  uiLocale: UiLocale;
  /** Текущий стримящийся токен (показывается пока идёт генерация) */
  streamingContent?: string;
  isStreaming?: boolean;
}

export default function AgentCard({ answer, uiLocale, streamingContent, isStreaming }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const color = agentColors[answer.id] ?? "var(--accent)";

  const displayContent = isStreaming && streamingContent ? streamingContent : answer.content;
  const preview = getVerdictPreview(displayContent);

  return (
    <div className="agent-card" style={{ "--agent-color": color } as React.CSSProperties}>
      <div className="agent-card-header">
        <div className="agent-card-avatar" style={{ background: color }} />
        <div className="agent-card-meta">
          <span className="agent-card-name">{answer.title}</span>
          <span className="agent-card-model">
            {answer.model}
            {!isStreaming && ` • ${answer.durationMs} ${t(uiLocale, "ms")}`}
            {isStreaming && " • ⏳"}
          </span>
        </div>
      </div>
      <button
        type="button"
        className="agent-card-preview"
        onClick={() => setExpanded(!expanded)}
      >
        {preview}
        {isStreaming && !expanded && <span className="streaming-cursor" />}
      </button>
      {(expanded || isStreaming) && (
        <div className="agent-card-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
          {isStreaming && <span className="streaming-cursor" />}
        </div>
      )}
    </div>
  );
}
