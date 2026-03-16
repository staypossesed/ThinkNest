import type { AskResponse, AgentAnswer } from "../../shared/types";
import type { UiLocale } from "./LanguageSelector";
import ShareButton from "./ShareButton";
import { t } from "../i18n";

interface Props {
  question: string;
  answers: AgentAnswer[];
  final: AskResponse["final"] | null;
  uiLocale: UiLocale;
}

function buildMarkdown(
  question: string,
  answers: AgentAnswer[],
  final: AskResponse["final"] | null,
  finalAnswerLabel: string
): string {
  const lines: string[] = [];
  lines.push(`# ${question}`);
  lines.push("");
  lines.push(`*${new Date().toLocaleString()}*`);
  lines.push("");
  for (const a of answers) {
    lines.push(`## ${a.title} (${a.model})`);
    lines.push(a.content);
    lines.push("");
  }
  if (final) {
    lines.push("---");
    lines.push(`## ${finalAnswerLabel}`);
    lines.push(final.content);
  }
  return lines.join("\n");
}

export default function ExportPanel({ question, answers, final, uiLocale }: Props) {
  const md = buildMarkdown(question, answers, final, t(uiLocale, "finalAnswerSection"));
  const filename = `thinknest-${Date.now()}.md`;

  const exportMarkdown = () => {
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(md);
    } catch {
      // fallback
    }
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={exportMarkdown}
        title={t(uiLocale, "downloadMd")}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        📄 {t(uiLocale, "downloadMd")}
      </button>
      <button
        type="button"
        onClick={copyMarkdown}
        title={t(uiLocale, "copy")}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        📋 {t(uiLocale, "copy")}
      </button>
      <ShareButton question={question} answers={answers} final={final} uiLocale={uiLocale} />
    </div>
  );
}
