import type { UiLocale } from "./LanguageSelector";
import type { UserMemory } from "../hooks/useMemory";

interface Props {
  memory: UserMemory;
  onChange: (updates: Partial<UserMemory>) => void;
  uiLocale: UiLocale;
  onClose: () => void;
}

const labels: Record<keyof UserMemory, Record<string, string>> = {
  name: { ru: "Ваше имя", en: "Your name", zh: "您的姓名" },
  profession: { ru: "Профессия / роль", en: "Profession / role", zh: "职业/角色" },
  interests: { ru: "Интересы / специализация", en: "Interests / expertise", zh: "兴趣/专长" },
  language: { ru: "Язык общения", en: "Communication language", zh: "交流语言" },
  additionalContext: { ru: "Дополнительный контекст", en: "Additional context", zh: "附加背景信息" }
};

const placeholders: Record<keyof UserMemory, Record<string, string>> = {
  name: { ru: "Алексей", en: "Alex", zh: "小明" },
  profession: { ru: "Frontend разработчик, 5 лет опыта", en: "Frontend dev, 5 yrs exp", zh: "前端开发，5年经验" },
  interests: { ru: "React, TypeScript, AI, крипто", en: "React, TypeScript, AI, crypto", zh: "React, TypeScript, AI, 加密货币" },
  language: { ru: "Русский", en: "English", zh: "中文" },
  additionalContext: { ru: "Предпочитаю конкретные примеры кода", en: "Prefer concrete code examples", zh: "偏好具体代码示例" }
};

export default function MemoryPanel({ memory, onChange, uiLocale, onClose }: Props) {
  const loc = uiLocale;
  const title = loc === "ru" ? "Личная память" : loc === "zh" ? "个人记忆" : "Personal memory";
  const saveLabel = loc === "ru" ? "Сохранено" : loc === "zh" ? "已保存" : "Auto-saved";
  const clearLabel = loc === "ru" ? "Очистить" : loc === "zh" ? "清除" : "Clear";
  const closeLabel = loc === "ru" ? "Закрыть" : loc === "zh" ? "关闭" : "Close";
  const desc = loc === "ru"
    ? "Агенты учитывают эту информацию в каждом ответе."
    : loc === "zh"
      ? "智能体在每个回答中都会考虑这些信息。"
      : "Agents use this information in every response.";

  return (
    <div className="delete-confirm-overlay" onClick={onClose}>
      <div className="delete-confirm-modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>🧠 {title}</h3>
          <button className="onboarding-btn-link" onClick={onClose}>{closeLabel}</button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: "0.8rem", color: "var(--text-muted)" }}>{desc}</p>
        <div className="memory-panel">
          {(Object.keys(memory) as (keyof UserMemory)[]).map((field) => (
            <div className="memory-field" key={field}>
              <label>{labels[field][loc] ?? labels[field].en}</label>
              {field === "additionalContext" ? (
                <textarea
                  rows={3}
                  value={memory[field]}
                  placeholder={placeholders[field][loc] ?? placeholders[field].en}
                  onChange={(e) => onChange({ [field]: e.target.value })}
                />
              ) : (
                <input
                  type="text"
                  value={memory[field]}
                  placeholder={placeholders[field][loc] ?? placeholders[field].en}
                  onChange={(e) => onChange({ [field]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8 }}>
          <button
            className="onboarding-btn-link"
            style={{ color: "var(--error)" }}
            onClick={() => onChange({ name: "", profession: "", interests: "", language: "", additionalContext: "" })}
          >
            {clearLabel}
          </button>
          <span style={{ fontSize: "0.75rem", color: "var(--success)" }}>✓ {saveLabel}</span>
        </div>
      </div>
    </div>
  );
}
