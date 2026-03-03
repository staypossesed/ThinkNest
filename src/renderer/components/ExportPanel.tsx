import type { AskResponse, AgentAnswer } from "../../shared/types";
import type { UiLocale } from "./LanguageSelector";
import ShareButton from "./ShareButton";

interface Props {
  question: string;
  answers: AgentAnswer[];
  final: AskResponse["final"] | null;
  uiLocale: UiLocale;
}

function buildMarkdown(question: string, answers: AgentAnswer[], final: AskResponse["final"] | null): string {
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
    lines.push("## Итоговый ответ");
    lines.push(final.content);
  }
  return lines.join("\n");
}

export default function ExportPanel({ question, answers, final, uiLocale }: Props) {
  const md = buildMarkdown(question, answers, final);
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
    <div className="export-buttons">
      <button className="export-btn" onClick={exportMarkdown} title="Export Markdown">
        📄 {uiLocale === "ru" ? "Скачать MD" : uiLocale === "zh" ? "下载 MD" : "Download MD"}
      </button>
      <button className="export-btn" onClick={copyMarkdown} title="Copy Markdown">
        📋 {uiLocale === "ru" ? "Копировать" : uiLocale === "zh" ? "复制" : "Copy"}
      </button>
      <ShareButton question={question} answers={answers} final={final} uiLocale={uiLocale} />
    </div>
  );
}
