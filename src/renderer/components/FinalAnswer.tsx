import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AskResponseSources } from "../../shared/types";
import type { UiLocale } from "./LanguageSelector";
import { t } from "../i18n";

interface FinalAnswerProps {
  final: { content: string; model: string; durationMs: number };
  webSources?: AskResponseSources | null;
  uiLocale: UiLocale;
}

/** Краткое summary судьи: победитель + причина в 1–2 строки */
function getJudgeSummary(content: string, maxLen = 140): string {
  const winnerMatch = content.match(/(?:Победитель|Winner):\s*\*?\*?([^*]+)\*?\*?/i);
  const reasonMatch = content.match(/(?:Причина|Reason):\s*\*?([^*\n]+)\*?/i);
  const winner = winnerMatch?.[1]?.trim() ?? "";
  const reason = reasonMatch?.[1]?.trim() ?? "";
  let summary = winner ? `🏆 Победитель: ${winner}` : "";
  if (reason) summary += summary ? `. Причина: ${reason}` : `🏆 ${reason}`;
  if (!summary) {
    const first = content.split("\n")[0]?.trim() ?? "";
    return first.length <= maxLen ? first : first.slice(0, maxLen) + "…";
  }
  return summary.length <= maxLen ? summary : summary.slice(0, maxLen) + "…";
}

export default function FinalAnswer({ final, webSources, uiLocale }: FinalAnswerProps) {
  const [expanded, setExpanded] = useState(false);
  const summary = getJudgeSummary(final.content);

  return (
    <div className="final-answer">
      <button
        type="button"
        className="final-answer-preview"
        onClick={() => setExpanded(!expanded)}
      >
        {summary}
      </button>
      {expanded && (
        <div className="final-answer-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{final.content}</ReactMarkdown>
        </div>
      )}
      <p className="final-answer-meta">
        {final.model} • {final.durationMs} {t(uiLocale, "ms")}
      </p>
      {webSources && webSources.results.length > 0 && (
        <div className="final-answer-sources">
          <h4>{t(uiLocale, "sources")}</h4>
          <ul>
            {webSources.results.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="source-link"
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
