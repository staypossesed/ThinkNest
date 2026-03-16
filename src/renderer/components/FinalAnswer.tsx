import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import type { AgentAnswer, AskResponseSources } from "../../shared/types";
import type { UiLocale } from "./LanguageSelector";
import ExportPanel from "./ExportPanel";
import { t } from "../i18n";

interface FinalAnswerProps {
  final: { content: string; model: string; durationMs: number };
  webSources?: AskResponseSources | null;
  uiLocale: UiLocale;
  question?: string;
  answers?: AgentAnswer[];
  perspectivesCount?: number;
}

function getJudgeSummary(content: string, maxLen = 200): string {
  const winnerMatch = content.match(/(?:Winner|Победитель):\s*\*?\*?([^*]+)\*?\*?/i);
  const reasonMatch = content.match(/(?:Reason|Причина):\s*\*?([^*\n]+)\*?/i);
  const winner = winnerMatch?.[1]?.trim() ?? "";
  const reason = reasonMatch?.[1]?.trim() ?? "";
  let summary = winner ? `Winner: ${winner}` : "";
  if (reason) summary += summary ? `. Reason: ${reason}` : reason;
  if (!summary) {
    const first = content.split("\n")[0]?.trim() ?? "";
    return first.length <= maxLen ? first : first.slice(0, maxLen) + "…";
  }
  return summary.length <= maxLen ? summary : summary.slice(0, maxLen) + "…";
}

export default function FinalAnswer({
  final,
  webSources,
  uiLocale,
  question = "",
  answers = [],
  perspectivesCount = 1
}: FinalAnswerProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const summary = getJudgeSummary(final.content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(final.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className="animate-card-in mt-6 rounded-2xl border-2 border-purple-500/30 bg-gradient-to-b from-purple-500/15 to-purple-900/10 p-6 backdrop-blur-xl"
      style={{
        boxShadow:
          "0 0 60px -12px rgba(139, 92, 246, 0.4), 0 0 24px -8px rgba(139, 92, 246, 0.2), inset 0 1px 0 0 rgba(255,255,255,0.1)"
      }}
    >
      <div className="mb-4">
        <h3 className="text-xl font-bold tracking-tight text-white">
          <span className="text-purple-400">{t(uiLocale, "finalConclusion1")}</span>{" "}
          {t(uiLocale, "finalConclusion2")}
        </h3>
        {perspectivesCount > 1 && (
          <p className="mt-1 text-sm text-gray-400">
            {perspectivesCount === 2
              ? t(uiLocale, "synthesizedFrom2")
              : t(uiLocale, "synthesizedFrom4")}
          </p>
        )}
      </div>

      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          className="min-w-0 flex-1 text-left text-base leading-relaxed text-gray-300 transition-colors hover:text-white"
          onClick={() => setExpanded(!expanded)}
        >
          {summary}
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            title={t(uiLocale, "copy")}
          >
            {copied ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
          </button>
          <button
            type="button"
            className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-green-400"
            title={t(uiLocale, "thumbsUp")}
          >
            <ThumbsUp className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-red-400"
            title={t(uiLocale, "thumbsDown")}
          >
            <ThumbsDown className="h-5 w-5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-5 border-t border-white/10 pt-5">
          <div className="scrollbar-chat max-h-[420px] overflow-y-auto text-base leading-relaxed text-gray-300 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-3 [&_ol]:my-3 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_pre]:overflow-x-auto [&_a]:text-purple-400 [&_a]:underline">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{final.content}</ReactMarkdown>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">
        {final.model} • {final.durationMs} {t(uiLocale, "ms")}
      </p>

      {answers.length > 0 && (
        <ExportPanel question={question} answers={answers} final={final} uiLocale={uiLocale} />
      )}

      {webSources && webSources.results.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-gray-400">{t(uiLocale, "sources")}</h4>
          <ul className="space-y-1 pl-5">
            {webSources.results.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="text-left text-sm text-purple-400 underline transition-colors hover:text-purple-300"
                  onClick={() => window.api.openExternal(s.url)}
                >
                  {s.title || s.url}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
