import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import logo from "../assets/logo.svg";
import type { Conversation, SessionState, Entitlements } from "../../shared/types";
import type { UiLocale } from "./LanguageSelector";
import { t } from "../i18n";

const DONT_ASK_DELETE_KEY = "thinknest_dont_ask_delete";

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
  uiLocale: UiLocale;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onCollapseToggle?: () => void;
}

function formatDate(ts: number, locale: UiLocale): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const loc = locale === "ru" ? "ru-RU" : locale === "zh" ? "zh-CN" : "en-US";
  if (diff < 60000) return t(locale, "justNow");
  if (diff < 3600000) return `${Math.floor(diff / 60000)} ${t(locale, "min")}`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString(loc, { day: "numeric", month: "short" });
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
  loadingSession,
  uiLocale,
  mobileOpen = false,
  onMobileClose,
  collapsed = false,
  onCollapseToggle
}: ChatSidebarProps) {
  const [deleteModal, setDeleteModal] = useState<{ id: string } | null>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const fn = () => setIsMobile(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const profileName = session.user
    ? session.user.fullName?.trim()
      ? session.user.fullName.trim().split(/\s+/)[0]
      : session.user.email.split("@")[0]
    : "Guest";

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      if (localStorage.getItem(DONT_ASK_DELETE_KEY) === "1") {
        onDelete(id);
        return;
      }
    } catch {}
    setDeleteModal({ id });
    setDontAskAgain(false);
  };

  const handleConfirmDelete = () => {
    if (!deleteModal) return;
    try {
      if (dontAskAgain) localStorage.setItem(DONT_ASK_DELETE_KEY, "1");
    } catch {}
    onDelete(deleteModal.id);
    setDeleteModal(null);
  };

  const handleCancelDelete = () => {
    setDeleteModal(null);
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="chat-sidebar-backdrop"
          onClick={onMobileClose}
          onKeyDown={(e) => e.key === "Escape" && onMobileClose?.()}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}
    <aside className={`chat-sidebar ${mobileOpen ? "chat-sidebar--mobile-open" : ""} ${collapsed ? "chat-sidebar--collapsed" : ""}`}>
      {(onMobileClose || onCollapseToggle) && (
        <button
          type="button"
          className="chat-sidebar-close"
          onClick={() => (isMobile ? onMobileClose?.() : onCollapseToggle?.())}
          aria-label={isMobile ? (uiLocale === "ru" ? "Закрыть" : "Close") : (uiLocale === "ru" ? "Свернуть меню" : "Collapse sidebar")}
        >
          ×
        </button>
      )}
      <div className="chat-sidebar-brand">
        <img src={logo} alt="" className="chat-sidebar-logo" />
        <span className="chat-sidebar-title">ThinkNest</span>
      </div>
      <button type="button" className="chat-sidebar-new" onClick={onNewChat}>
        {t(uiLocale, "newChatBtn")}
      </button>
      <div className="chat-sidebar-list">
        {conversations.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            className={`chat-sidebar-item ${c.id === activeId ? "chat-sidebar-item--active" : ""}`}
            onClick={() => onSelect(c.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(c.id);
              }
            }}
          >
            <div className="chat-sidebar-item-content">
              <span className="chat-sidebar-item-preview">
                {getPreview(c.messages[0]?.question ?? t(uiLocale, "newChat"))}
              </span>
              <span className="chat-sidebar-item-date">
                {formatDate(c.updatedAt, uiLocale)}
              </span>
            </div>
            <button
              type="button"
              className="chat-sidebar-item-delete"
              onClick={(e) => handleDeleteClick(e, c.id)}
              aria-label={t(uiLocale, "delete")}
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
                {t(uiLocale, "refresh")}
              </button>
              {entitlements?.plan === "free" && (
                <button type="button" onClick={onUpgrade}>
                  {t(uiLocale, "pro")}
                </button>
              )}
              {entitlements?.plan === "pro" && (
                <button type="button" onClick={onManageBilling}>
                  {t(uiLocale, "billing")}
                </button>
              )}
              <button type="button" onClick={onLogout}>
                {t(uiLocale, "logout")}
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
            {loadingSession ? t(uiLocale, "loginGoogleLoading") : t(uiLocale, "loginGoogle")}
          </button>
        )}
      </div>

      {deleteModal &&
        createPortal(
          <div
            className="delete-confirm-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                e.preventDefault();
                handleCancelDelete();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <h3 id="delete-confirm-title" className="delete-confirm-title">
                {t(uiLocale, "deleteConfirmTitle")}
              </h3>
              <p className="delete-confirm-text">{t(uiLocale, "deleteConfirmText")}</p>
              <label className="delete-confirm-dont-ask">
                <input
                  type="checkbox"
                  checked={dontAskAgain}
                  onChange={(e) => setDontAskAgain(e.target.checked)}
                />
                <span>{t(uiLocale, "dontAskAgain")}</span>
              </label>
              <div className="delete-confirm-actions">
                <button type="button" className="delete-confirm-cancel" onClick={handleCancelDelete}>
                  {t(uiLocale, "cancel")}
                </button>
                <button type="button" className="delete-confirm-ok" onClick={handleConfirmDelete}>
                  {t(uiLocale, "confirm")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </aside>
    </>
  );
}
