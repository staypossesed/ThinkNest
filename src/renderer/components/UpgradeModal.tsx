import type { UiLocale } from "./LanguageSelector";

interface UpgradeModalProps {
  uiLocale: UiLocale;
  onClose: () => void;
  onSelectPlan: (plan: "weekly" | "monthly" | "yearly") => void;
}

const PLANS = [
  { id: "weekly" as const, emoji: "📅", label: { ru: "Неделя", en: "Week", zh: "周" }, price: { ru: "$4.99/нед", en: "$4.99/week", zh: "$4.99/周" } },
  { id: "monthly" as const, emoji: "📆", label: { ru: "Месяц", en: "Month", zh: "月" }, price: { ru: "$14.99/мес", en: "$14.99/month", zh: "$14.99/月" } },
  { id: "yearly" as const, emoji: "🎁", label: { ru: "Год (скидка 30%)", en: "Year (30% off)", zh: "年 (7折)" }, price: { ru: "$149.99/год", en: "$149.99/year", zh: "$149.99/年" } }
];

export default function UpgradeModal({ uiLocale, onClose, onSelectPlan }: UpgradeModalProps) {
  const loc = uiLocale;

  return (
    <div className="upgrade-modal-overlay" onClick={onClose} role="presentation">
      <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="upgrade-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 className="upgrade-modal-title">
          {loc === "ru" ? "Выберите тариф" : loc === "zh" ? "选择套餐" : "Choose your plan"}
        </h2>
        <p className="upgrade-modal-subtitle">
          {loc === "ru"
            ? "Pro: 4 агента, веб-поиск, прогнозы, память"
            : loc === "zh"
              ? "Pro：4个智能体、网络搜索、预测、记忆"
              : "Pro: 4 agents, web search, forecasts, memory"}
        </p>
        <div className="upgrade-modal-plans">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="upgrade-modal-plan"
              onClick={() => onSelectPlan(p.id)}
            >
              <span className="upgrade-modal-plan-emoji">{p.emoji}</span>
              <span className="upgrade-modal-plan-label">{p.label[loc] || p.label.en}</span>
              <span className="upgrade-modal-plan-price">{p.price[loc] || p.price.en}</span>
            </button>
          ))}
        </div>
        <button type="button" className="upgrade-modal-cancel" onClick={onClose}>
          {loc === "ru" ? "Отмена" : loc === "zh" ? "取消" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
