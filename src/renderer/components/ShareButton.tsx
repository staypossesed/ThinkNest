import { useState } from "react";
import type { AgentAnswer, AskResponse } from "../../shared/types";
import type { UiLocale } from "./LanguageSelector";

interface Props {
  question: string;
  answers: AgentAnswer[];
  final: AskResponse["final"] | null;
  uiLocale: UiLocale;
}

function buildShareHtml(question: string, answers: AgentAnswer[], final: AskResponse["final"] | null): string {
  const agentColors: Record<string, string> = {
    planner: "#6366f1",
    critic: "#f59e0b",
    pragmatist: "#10b981",
    explainer: "#8b5cf6"
  };

  const answersHtml = answers.map((a) => `
    <div style="border:1px solid ${agentColors[a.id] ?? "#444"};border-radius:12px;padding:16px;margin-bottom:12px;background:#161a21;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:12px;height:12px;border-radius:50%;background:${agentColors[a.id] ?? "#444"}"></div>
        <strong style="color:#f0f2f5">${a.title}</strong>
        <span style="color:#6b7280;font-size:0.8rem">${a.model}</span>
      </div>
      <div style="color:#9ca3af;font-size:0.9rem;line-height:1.6;white-space:pre-wrap">${a.content.replace(/</g, "&lt;")}</div>
    </div>
  `).join("");

  const finalHtml = final ? `
    <div style="border:1px solid rgba(99,102,241,0.4);border-radius:12px;padding:16px;background:rgba(99,102,241,0.08);">
      <div style="color:#a5b4fc;font-size:0.9rem;line-height:1.6;white-space:pre-wrap">${final.content.replace(/</g, "&lt;")}</div>
    </div>
  ` : "";

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ThinkNest: ${question.slice(0, 60)}</title>
  <style>
    body { background:#0c0e12; color:#f0f2f5; font-family:-apple-system,BlinkMacSystemFont,sans-serif; padding:32px; max-width:800px; margin:0 auto; }
    h1 { font-size:1.3rem; font-weight:700; margin-bottom:8px; }
    p { color:#6b7280; font-size:0.85rem; margin:0 0 24px; }
    .brand { display:flex; align-items:center; gap:10px; margin-bottom:32px; color:#6b7280; font-size:0.8rem; }
  </style>
</head>
<body>
  <div class="brand">🧠 ThinkNest — мультиагентный ИИ</div>
  <h1>${question.replace(/</g, "&lt;")}</h1>
  <p>4 эксперта ответили на этот вопрос</p>
  ${answersHtml}
  ${finalHtml}
  <p style="margin-top:32px;text-align:center">Создано в <strong>ThinkNest</strong></p>
</body>
</html>`;
}

export default function ShareButton({ question, answers, final, uiLocale }: Props) {
  const [copied, setCopied] = useState(false);

  const share = () => {
    const html = buildShareHtml(question, answers, final);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    // Open in browser
    window.api.openExternal(url);
    // Copy to clipboard
    const md = `# ${question}\n\n${answers.map((a) => `## ${a.title}\n${a.content}`).join("\n\n")}`;
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const label = copied
    ? (uiLocale === "ru" ? "✅ Скопировано" : "✅ Copied")
    : (uiLocale === "ru" ? "🔗 Поделиться" : uiLocale === "zh" ? "🔗 分享" : "🔗 Share");

  return (
    <button
      type="button"
      onClick={share}
      title="Share"
      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
    >
      {label}
    </button>
  );
}
