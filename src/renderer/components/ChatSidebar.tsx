import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Settings } from "lucide-react";
import Logo from "./Logo";
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
  subscription?: {
    active: boolean;
    interval: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
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
  onCollapseToggle,
  subscription = null
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
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onMobileClose}
          onKeyDown={(e) => e.key === "Escape" && onMobileClose?.()}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}
    <aside
      className={`relative flex w-[260px] shrink-0 flex-col border-r border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-200 ${
        collapsed ? "w-0 min-w-0 overflow-hidden border-r-0" : ""
      } ${mobileOpen ? "fixed inset-y-0 left-0 z-50" : ""}`}
    >
      {(mobileOpen && onMobileClose) || onCollapseToggle ? (
        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          onClick={() => (isMobile && mobileOpen ? onMobileClose?.() : onCollapseToggle?.())}
          aria-label={isMobile && mobileOpen ? (uiLocale === "ru" ? "Закрыть" : "Close") : (uiLocale === "ru" ? "Свернуть чаты" : "Collapse chats")}
        >
          ×
        </button>
      ) : null}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <Logo className="h-9 w-9" />
        <span className="text-lg font-bold tracking-tight text-white">ThinkNest</span>
      </div>
      <button
        type="button"
        className="mx-4 mt-4 flex w-[calc(100%-32px)] items-center justify-center rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
        onClick={onNewChat}
      >
        {t(uiLocale, "newChatBtn")}
      </button>
      <div className="scrollbar-chat flex-1 overflow-y-auto py-2">
        {conversations.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            className={`mx-2 flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all duration-200 hover:bg-white/10 ${
              c.id === activeId ? "bg-white/10" : ""
            }`}
            onClick={() => onSelect(c.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(c.id);
              }
            }}
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm text-white">
                {getPreview(c.messages[0]?.question ?? t(uiLocale, "newChat"))}
              </span>
              <span className="text-xs text-gray-500">{formatDate(c.updatedAt, uiLocale)}</span>
            </div>
            <button
              type="button"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 opacity-60 transition-opacity hover:opacity-100 hover:text-red-400"
              onClick={(e) => handleDeleteClick(e, c.id)}
              aria-label={t(uiLocale, "delete")}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-4">
        {devMode ? (
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400">Dev</span>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        ) : session.user ? (
          <>
            <p className="text-xs text-gray-500">
              {profileName} • {entitlements?.plan ?? "—"}
            </p>
            {entitlements && (
              <p className="text-xs text-gray-500">
                {entitlements.usedQuestions}/{entitlements.maxQuestions}
              </p>
            )}
            {entitlements?.plan === "pro" && (
              <>
                <button
                  type="button"
                  className="mt-2 w-full rounded-xl bg-purple-600/80 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
                  onClick={onManageBilling}
                  title={t(uiLocale, "manageSubscription")}
                >
                  {t(uiLocale, "mySubscription")}
                </button>
                {subscription?.active && subscription.currentPeriodEnd && (() => {
                  const endDate = new Date(subscription.currentPeriodEnd);
                  const now = new Date();
                  const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
                  return (
                    <p className="mt-1.5 text-center text-xs text-gray-500">
                      {subscription.cancelAtPeriodEnd
                        ? (uiLocale === "ru" ? "Отмена после периода" : uiLocale === "zh" ? "期后取消" : "Cancels after period")
                        : `${daysLeft} ${t(uiLocale, "daysLeft")}`}
                      {" · "}
                      {endDate.toLocaleDateString(uiLocale === "ru" ? "ru-RU" : uiLocale === "zh" ? "zh-CN" : "en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                      })}
                    </p>
                  );
                })()}
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                onClick={onRefreshPlan}
              >
                {t(uiLocale, "refresh")}
              </button>
              {entitlements?.plan === "free" && (
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 text-xs text-purple-400 transition-colors hover:bg-white/10"
                  onClick={onUpgrade}
                >
                  {t(uiLocale, "pro")}
                </button>
              )}
              <button
                type="button"
                className="rounded-lg px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                onClick={onLogout}
              >
                {t(uiLocale, "logout")}
              </button>
            </div>
            <button
              type="button"
              className="mt-2 flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onLogin}
              disabled={loadingSession}
              className="w-full rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
            >
              {loadingSession ? t(uiLocale, "loginGoogleLoading") : t(uiLocale, "loginGoogle")}
            </button>
            <button
              type="button"
              className="mt-2 flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </>
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
