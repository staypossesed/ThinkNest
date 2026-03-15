import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type {
  AgentAnswer,
  AskResponse,
  ConversationMessage,
  Entitlements,
  SessionState
} from "../shared/types";
import ChatSidebar from "./components/ChatSidebar";
import Logo from "./components/Logo";
import ChatMain from "./components/ChatMain";
import MessageInput from "./components/MessageInput";
import LanguageSelector, { type UiLocale } from "./components/LanguageSelector";
import Onboarding from "./components/Onboarding";
import MemoryPanel from "./components/MemoryPanel";
import UpgradeModal from "./components/UpgradeModal";
import { useConversations } from "./hooks/useConversations";
import { usePlaceholder } from "./hooks/usePlaceholder";
import { useMemory } from "./hooks/useMemory";
import { t } from "./i18n";
import { isWebMode } from "./webApi";
import { debug, debugWarn } from "./debug";

const ONBOARDING_DONE_KEY = "thinknest_onboarding_done";
const MODE_STORAGE_KEY = "thinknest_mode";

const LANG_STORAGE_KEY = "thinknest_ui_locale";

/** Определяет язык вопроса по символам (кириллица, CJK, латиница) */
function detectQuestionLanguage(input: string): UiLocale {
  const t = input.trim();
  if (!t.length) return "en";
  if (/[\u4E00-\u9FFF\u3400-\u4DBF]/.test(t)) return "zh";
  if (/[\u0400-\u04FF]/.test(t)) return "ru";
  return "en";
}

function detectSystemLocale(): UiLocale {
  if (typeof navigator === "undefined") return "ru";
  const lang = (navigator.language ?? navigator.languages?.[0] ?? "").toLowerCase();
  if (/^(ru|uk|be)/.test(lang)) return "ru";
  if (/^zh/.test(lang)) return "zh";
  return "en";
}

const agentOrder = ["planner", "critic", "pragmatist", "explainer"] as const;

export default function App() {
  const [question, setQuestion] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [loadingConversationIds, setLoadingConversationIds] = useState<Set<string>>(new Set());
  const [useWebData, setUseWebData] = useState(false);
  const [forecastMode, setForecastMode] = useState(false);
  const [deepResearchMode, setDeepResearchMode] = useState(false);
  const [expertProfile, setExpertProfile] = useState("");
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [subscription, setSubscription] = useState<{
    active: boolean;
    interval: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("thinknest_sidebar_collapsed") === "1"; } catch { return false; }
  });
  const [session, setSession] = useState<SessionState>({ token: null, user: null });
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem(ONBOARDING_DONE_KEY); } catch { return false; }
  });
  const { memory, setMemory, memoryContext } = useMemory();
  const [uiLocale, setUiLocale] = useState<UiLocale>(() => {
    try {
      const s = localStorage.getItem(LANG_STORAGE_KEY);
      if (s === "ru" || s === "en" || s === "zh") return s;
    } catch {}
    return detectSystemLocale();
  });

  const answersRef = useRef<AgentAnswer[]>([]);
  const [streamingTokens, setStreamingTokens] = useState<Record<string, string>>({});

  const {
    conversations,
    activeId,
    activeConversation,
    createConversationWithFirstMessage,
    addMessagePlaceholder,
    updateMessage,
    selectConversation,
    deleteConversation,
    newChat
  } = useConversations(devMode);

  const loading = loadingConversationIds.size > 0;
  const isLoadingInCurrentChat = activeId != null && loadingConversationIds.has(activeId);

  const handleLocaleChange = (locale: UiLocale) => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, locale);
    } catch {}
    flushSync(() => setUiLocale(locale));
    if (loading && window.api?.setAskLocale) {
      window.api.setAskLocale(locale);
    }
  };

  useEffect(() => {
    try {
      if (localStorage.getItem(LANG_STORAGE_KEY)) return;
      const loc = session.user?.locale?.toLowerCase();
      if (!loc) return;
      const fromGoogle: UiLocale = /^(ru|uk|be)/.test(loc) ? "ru" : /^zh/.test(loc) ? "zh" : "en";
      setUiLocale(fromGoogle);
      localStorage.setItem(LANG_STORAGE_KEY, fromGoogle);
    } catch {}
  }, [session.user?.locale]);

  const messages = activeConversation?.messages ?? [];
  const maxAgents = entitlements?.maxAgents ?? 4;
  const inputPlaceholder = usePlaceholder(uiLocale);

  const statusText = useMemo(() => {
    if (!loading) return "";
    if (!isLoadingInCurrentChat) return t(uiLocale, "loadingInOtherChat");
    if (messages.length === 0) return t(uiLocale, "plannerResponds");
    const last = messages[messages.length - 1];
    const count = last?.answers.length ?? 0;
    if (count >= maxAgents) return t(uiLocale, "formingResult");
    return `${t(uiLocale, agentOrder[count])} ${t(uiLocale, "agentResponds")}`;
  }, [loading, isLoadingInCurrentChat, messages, maxAgents, uiLocale]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        if (typeof window.api === "undefined") {
          debugWarn("App", "bootstrap: no window.api");
          setError("API недоступен. Перезапустите приложение.");
          return;
        }
        const isDev = await window.api.isDevMode();
        setDevMode(isDev);
        debug("App", "bootstrap", { isDev });
        const currentSession = await window.api.getSession();
        setSession(currentSession);
        debug("App", "bootstrap session", { hasToken: !!currentSession.token, email: currentSession.user?.email });
        if (isDev || currentSession.token) {
          const currentEntitlements = await window.api.getEntitlements();
          setEntitlements(currentEntitlements);
          debug("App", "bootstrap entitlements", { plan: currentEntitlements?.plan, maxAgents: currentEntitlements?.maxAgents });
          if (currentSession.token && window.api.getSubscription) {
            try {
              const sub = await window.api.getSubscription();
              setSubscription(sub);
            } catch {
              setSubscription(null);
            }
          }
        } else if (isWebMode()) {
          try {
            const currentEntitlements = await window.api.getEntitlements();
            setEntitlements(currentEntitlements);
          } catch {
            setEntitlements(null);
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t(uiLocale, "loadSessionFailed");
        debugWarn("App", "bootstrap error", err);
        setError(message);
      } finally {
        setLoadingSession(false);
      }
    };
    bootstrap();
  }, []);

  const refreshEntitlements = async (sessionOverride?: SessionState) => {
    const current = await window.api.getEntitlements();
    setEntitlements(current);
    const sess = sessionOverride ?? session;
    try {
      if (window.api.getSubscription && sess.token) {
        const sub = await window.api.getSubscription();
        setSubscription(sub);
      }
    } catch {
      setSubscription(null);
    }
  };

  const handleLogin = async () => {
    setError(null);
    setLoadingSession(true);
    try {
      const nextSession = await window.api.loginWithGoogle();
      setSession(nextSession);
      await refreshEntitlements(nextSession);
    } catch (err) {
      const message = err instanceof Error ? err.message : t(uiLocale, "loginFailed");
      setError(message);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleLogout = async () => {
    setError(null);
    await window.api.logout();
    setSession({ token: null, user: null });
    setEntitlements(null);
    setSubscription(null);
  };

  const handleUpgrade = () => {
    setError(null);
    setShowUpgradeModal(true);
  };

  const handleSelectPlan = async (plan: "weekly" | "monthly" | "yearly") => {
    setError(null);
    setShowUpgradeModal(false);
    try {
      await window.api.openCheckout(plan);
    } catch (err) {
      const message = err instanceof Error ? err.message : t(uiLocale, "checkoutFailed");
      setError(message);
    }
  };

  const handleManageBilling = async () => {
    setError(null);
    try {
      await window.api.openPortal();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t(uiLocale, "portalFailed");
      setError(message);
    }
  };

  const submit = async () => {
    const trimmed = question.trim();
    const hasContent = trimmed || attachedImages.length > 0;
    if (!hasContent || isLoadingInCurrentChat) return;
    if (!devMode && !session.token) {
      debug("App", "submit blocked: no session");
      setError(t(uiLocale, "loginFirst"));
      return;
    }
    debug("App", "submit", { question: trimmed.slice(0, 30), hasSession: !!session.token });

    const questionText =
      trimmed ||
      (attachedImages.length > 0
        ? "[Изображение]"
        : "");
    const imagesToSend = attachedImages.length > 0 ? attachedImages : undefined;
    setError(null);
    setQuestion("");
    setAttachedImages([]);

    let conv: { id: string };
    let placeholder: ConversationMessage;
    if (!activeConversation) {
      const result = createConversationWithFirstMessage(questionText, {
        useWebData,
        forecastMode,
        deepResearchMode,
        images: imagesToSend
      });
      conv = result.conv;
      placeholder = result.placeholder;
    } else {
      conv = activeConversation;
      placeholder = addMessagePlaceholder(conv.id, questionText, {
        useWebData,
        forecastMode,
        deepResearchMode,
        images: imagesToSend
      });
    }

    setLoadingConversationIds((prev) => new Set([...prev, conv.id]));
    setStreamingTokens({});
    answersRef.current = [];

    try {
      const canAsk = await window.api.canAsk();
      setEntitlements(canAsk.entitlements);
      if (!canAsk.allowed) {
        setError(canAsk.reason ?? t(uiLocale, "limitExceeded"));
        setLoadingConversationIds((prev) => {
          const next = new Set(prev);
          next.delete(conv.id);
          return next;
        });
        return;
      }

      // Force English for all agent responses and Final Answer
      const preferredLocale: "ru" | "en" | "zh" = "en";
      const ent = canAsk.entitlements;

      const mode = (() => {
        try {
          const m = localStorage.getItem(MODE_STORAGE_KEY);
          if (m === "fast" || m === "balanced" || m === "quality") return m;
        } catch {}
        return "balanced";
      })();
      const response = await window.api.ask(
        {
          question: questionText,
          maxAgents: ent.maxAgents,
          mode,
          useWebData: useWebData && (ent.allowWebData !== false),
          forecastMode: forecastMode && (ent.allowForecast !== false),
          deepResearchMode,
          debateMode: true,
          expertProfile: (ent.allowExpertProfile !== false && expertProfile) ? expertProfile : undefined,
          memoryContext: (ent.allowMemory !== false && memoryContext) ? memoryContext : undefined,
          preferredLocale,
          images: imagesToSend
        },
        (answer: AgentAnswer) => {
          answersRef.current = answersRef.current.filter((a) => a.id !== answer.id);
          answersRef.current.push(answer);
          answersRef.current.sort(
            (a, b) => agentOrder.indexOf(a.id) - agentOrder.indexOf(b.id)
          );
          // Clear streaming buffer for this agent when final answer arrives
          setStreamingTokens((prev) => {
            const next = { ...prev };
            delete next[answer.id];
            return next;
          });
          updateMessage(conv.id, placeholder.id, {
            answers: [...answersRef.current]
          });
        },
        (agentId: string, token: string) => {
          setStreamingTokens((prev) => ({
            ...prev,
            [agentId]: (prev[agentId] ?? "") + token
          }));
        }
      );

      updateMessage(conv.id, placeholder.id, {
        answers: response.answers,
        final: response.final,
        webSources: response.webSources ?? null
      });

      const usage = await window.api.consumeUsage(questionText);
      setEntitlements(usage.entitlements);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t(uiLocale, "askFailed");
      setError(message);
    } finally {
      setLoadingConversationIds((prev) => {
        const next = new Set(prev);
        next.delete(conv.id);
        return next;
      });
    }
  };

  const handleStop = () => {
    window.api.stopAsk?.();
  };

  const handleNewChat = () => {
    newChat();
    setQuestion("");
    setAttachedImages([]);
    setError(null);
  };

  return (
    <>
    <div className="web-mode-banner" role="status">
      📱 Веб-режим — войдите через Google и задавайте вопросы с мобилки
    </div>
    {showOnboarding && !isWebMode() && (
      <Onboarding
        uiLocale={uiLocale}
        useServerModels={!devMode}
        onComplete={() => {
          try { localStorage.setItem(ONBOARDING_DONE_KEY, "1"); } catch {}
          setShowOnboarding(false);
        }}
      />
    )}
    <div className="flex h-full min-h-screen bg-[#050505]">
      {(!sidebarCollapsed || sidebarOpen) && (
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => {
          selectConversation(id);
          setSidebarOpen(false);
        }}
        onNewChat={handleNewChat}
        onDelete={deleteConversation}
        session={session}
        entitlements={entitlements}
        devMode={devMode}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onUpgrade={handleUpgrade}
        onManageBilling={handleManageBilling}
        onRefreshPlan={refreshEntitlements}
        loadingSession={loadingSession}
        uiLocale={uiLocale}
        mobileOpen={sidebarOpen}
        subscription={subscription}
        onMobileClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapseToggle={() => {
          setSidebarCollapsed((v) => {
            const next = !v;
            try { localStorage.setItem("thinknest_sidebar_collapsed", next ? "1" : "0"); } catch {}
            return next;
          });
        }}
      />
      )}
      <main className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#050505] px-5 py-3">
          {sidebarCollapsed ? (
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 transition-colors hover:bg-white/10"
              onClick={() => {
                setSidebarCollapsed(false);
                try { localStorage.setItem("thinknest_sidebar_collapsed", "0"); } catch {}
              }}
              aria-label={uiLocale === "ru" ? "Показать чаты" : "Show chats"}
              title={uiLocale === "ru" ? "Показать чаты" : "Show chats"}
            >
              <Logo className="h-9 w-9 shrink-0" />
            </button>
          ) : (
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label={uiLocale === "ru" ? "Меню" : "Menu"}
            >
              ☰
            </button>
          )}
          <div className="flex-1" />
          <LanguageSelector value={uiLocale} onChange={handleLocaleChange} />
        </div>
        <ChatMain
          messages={messages}
          loading={isLoadingInCurrentChat}
          maxAgents={maxAgents}
          uiLocale={uiLocale}
          streamingTokens={isLoadingInCurrentChat ? streamingTokens : {}}
        />
        <div className="shrink-0 border-t border-white/10 bg-[#050505]/80 backdrop-blur-sm">
          <MessageInput
            value={question}
            onChange={setQuestion}
            onSubmit={submit}
            loading={isLoadingInCurrentChat}
            onStop={handleStop}
            loadingInOtherChat={loading && !isLoadingInCurrentChat}
            disabled={!devMode && !session.token}
            useWebData={useWebData}
            forecastMode={forecastMode}
            deepResearchMode={deepResearchMode}
            onUseWebDataChange={setUseWebData}
            onForecastModeChange={setForecastMode}
            onDeepResearchModeChange={setDeepResearchMode}
            statusText={statusText}
            error={error}
            placeholder={inputPlaceholder}
            images={attachedImages}
            onImagesChange={setAttachedImages}
            uiLocale={uiLocale}
            onOpenMemory={entitlements?.allowMemory !== false ? () => setShowMemoryPanel(true) : undefined}
            expertProfile={expertProfile}
            onExpertProfileChange={setExpertProfile}
            canUseWebData={entitlements?.allowWebData !== false}
            canUseForecast={entitlements?.allowForecast !== false}
            canUseExpertProfile={entitlements?.allowExpertProfile !== false}
            canUseMemory={entitlements?.allowMemory !== false}
          />
        </div>
      </main>
    </div>
    {showMemoryPanel && (
      <MemoryPanel
        memory={memory}
        onChange={setMemory}
        uiLocale={uiLocale}
        onClose={() => setShowMemoryPanel(false)}
      />
    )}
    {showUpgradeModal && (
      <UpgradeModal
        uiLocale={uiLocale}
        onClose={() => setShowUpgradeModal(false)}
        onSelectPlan={handleSelectPlan}
      />
    )}
    </>
  );
}
