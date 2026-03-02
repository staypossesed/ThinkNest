import logo from "../assets/logo.svg";
import type { Conversation, SessionState, Entitlements } from "../../shared/types";

interface ChatSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
  session: SessionState;
  entitlements: Entitlements | null;
  devMode: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onUpgrade: () => void;
  onManageBilling: () => void;
  onRefreshPlan: () => void;
  loadingSession: boolean;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Только что";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function getPreview(question: string, maxLen = 40): string {
  const t = question.trim().replace(/\s+/g, " ");
  return t.length <= maxLen ? t : t.slice(0, maxLen) + "…";
}

export default function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  session,
  entitlements,
  devMode,
  onLogin,
  onLogout,
  onUpgrade,
  onManageBilling,
  onRefreshPlan,
  loadingSession
}: ChatSidebarProps) {
  const profileName = session.user
    ? session.user.fullName?.trim()
      ? session.user.fullName.trim().split(/\s+/)[0]
      : session.user.email.split("@")[0]
    : "Guest";

  return (
    <aside className="chat-sidebar">
      <div className="chat-sidebar-brand">
        <img src={logo} alt="" className="chat-sidebar-logo" />
        <span className="chat-sidebar-title">ThinkNest</span>
      </div>
      <button type="button" className="chat-sidebar-new" onClick={onNewChat}>
        + Новый чат
      </button>
      <div className="chat-sidebar-list">
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`chat-sidebar-item ${c.id === activeId ? "chat-sidebar-item--active" : ""}`}
          >
            <button
              type="button"
              className="chat-sidebar-item-btn"
              onClick={() => onSelect(c.id)}
            >
              {getPreview(c.messages[0]?.question ?? "Новый чат")}
            </button>
            <span className="chat-sidebar-item-date">
              {formatDate(c.updatedAt)}
            </span>
            <button
              type="button"
              className="chat-sidebar-item-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              aria-label="Удалить"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="chat-sidebar-footer">
        {devMode ? (
          <span className="chat-sidebar-badge">Dev</span>
        ) : session.user ? (
          <>
            <p className="chat-sidebar-meta">
              {profileName} • {entitlements?.plan ?? "—"}
            </p>
            {entitlements && (
              <p className="chat-sidebar-meta">
                {entitlements.usedQuestions}/{entitlements.maxQuestions}
              </p>
            )}
            <div className="chat-sidebar-actions">
              <button type="button" onClick={onRefreshPlan}>
                Refresh
              </button>
              {entitlements?.plan === "free" && (
                <button type="button" onClick={onUpgrade}>
                  Pro
                </button>
              )}
              {entitlements?.plan === "pro" && (
                <button type="button" onClick={onManageBilling}>
                  Billing
                </button>
              )}
              <button type="button" onClick={onLogout}>
                Выйти
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={onLogin}
            disabled={loadingSession}
            className="chat-sidebar-login"
          >
            {loadingSession ? "..." : "Войти через Google"}
          </button>
        )}
      </div>
    </aside>
  );
}
