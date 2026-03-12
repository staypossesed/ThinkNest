import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import type { AgentAnswer } from "../../shared/types";
import type { UiLocale } from "./LanguageSelector";
import { t } from "../i18n";
import { AGENT_DISPLAY } from "../constants";

const AGENT_RING: Record<string, string> = {
  blue: "ring-blue-500/50",
  orange: "ring-amber-500/50",
  green: "ring-emerald-500/50",
  purple: "ring-purple-500/50",
};

function getVerdictPreview(content: string, maxLen = 100): string {
  const verdictMatch = content.match(/Вердикт:\s*(.+?)(?:\n|$)/i);
  if (verdictMatch) {
    const txt = verdictMatch[1].trim();
    return txt.length <= maxLen ? txt : txt.slice(0, maxLen) + "…";
  }
  const first = content.split("\n")[0]?.trim() ?? "";
  return first.length <= maxLen ? first : first.slice(0, maxLen) + "…";
}

interface AgentCardProps {
  answer: AgentAnswer;
  uiLocale: UiLocale;
  streamingContent?: string;
  isStreaming?: boolean;
  isActive?: boolean;
}

export default function AgentCard({ answer, uiLocale, streamingContent, isStreaming, isActive }: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const display = AGENT_DISPLAY[answer.id] ?? { name: answer.title, emoji: "🤖", color: "purple" };
  const displayContent = isStreaming && streamingContent ? streamingContent : answer.content;
  const preview = getVerdictPreview(displayContent);
  const ringClass = AGENT_RING[display.color] ?? "ring-purple-500/50";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className={`group animate-card-in rounded-xl border bg-white/5 p-4 backdrop-blur-xl transition-all duration-300 ${
        isActive
          ? "border-purple-500/40 shadow-lg shadow-purple-500/20"
          : "border-white/10 hover:border-white/15 hover:shadow-lg hover:shadow-purple-500/5"
      }`}
      style={{ boxShadow: isActive ? "0 0 24px -4px rgba(139, 92, 246, 0.35)" : "inset 0 1px 0 0 rgba(255,255,255,0.05)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xl ring-2 ${ringClass}`}
        >
          {display.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-white">{display.name}</span>
            <div className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                title={t(uiLocale, "copy")}
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-green-400"
                title="Thumbs up"
              >
                <ThumbsUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-red-400"
                title="Thumbs down"
              >
                <ThumbsDown className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-0.5 text-xs text-gray-400">
            {answer.model}
            {!isStreaming && ` • ${answer.durationMs} ${t(uiLocale, "ms")}`}
            {isStreaming && " • ⏳"}
          </p>
        </div>
      </div>

      <button
        type="button"
        className="mt-3 w-full text-left text-sm text-gray-300 transition-colors hover:text-white"
        onClick={() => setExpanded(!expanded)}
      >
        {preview}
        {isStreaming && !expanded && (
          <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-purple-400" />
        )}
      </button>

      {(expanded || isStreaming) && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="scrollbar-chat max-h-[280px] overflow-y-auto text-sm leading-relaxed text-gray-300 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ol]:my-2 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_pre]:overflow-x-auto [&_a]:text-purple-400 [&_a]:underline">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
          </div>
          {isStreaming && (
            <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-purple-400" />
          )}
        </div>
      )}
    </div>
  );
}
