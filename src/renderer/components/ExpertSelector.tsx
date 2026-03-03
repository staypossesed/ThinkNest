import type { UiLocale } from "./LanguageSelector";

export const EXPERT_PROFILES = [
  { id: "", emoji: "🧠", label: { ru: "Общий", en: "General", zh: "通用" } },
  { id: "lawyer", emoji: "⚖️", label: { ru: "Юрист", en: "Lawyer", zh: "律师" } },
  { id: "doctor", emoji: "🏥", label: { ru: "Врач", en: "Doctor", zh: "医生" } },
  { id: "investor", emoji: "📈", label: { ru: "Инвестор", en: "Investor", zh: "投资者" } },
  { id: "developer", emoji: "💻", label: { ru: "Разработчик", en: "Developer", zh: "开发者" } },
  { id: "teacher", emoji: "📚", label: { ru: "Учитель", en: "Teacher", zh: "教师" } },
  { id: "marketer", emoji: "📣", label: { ru: "Маркетолог", en: "Marketer", zh: "营销人员" } },
] as const;

interface Props {
  value: string;
  onChange: (id: string) => void;
  uiLocale: UiLocale;
  disabled?: boolean;
}

export default function ExpertSelector({ value, onChange, uiLocale, disabled }: Props) {
  return (
    <div className="expert-selector">
      {EXPERT_PROFILES.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`expert-btn ${value === p.id ? "expert-btn--active" : ""}`}
          onClick={() => onChange(p.id)}
          disabled={disabled}
          title={p.label[uiLocale] ?? p.label.en}
        >
          {p.emoji} {p.label[uiLocale] ?? p.label.en}
        </button>
      ))}
    </div>
  );
}
