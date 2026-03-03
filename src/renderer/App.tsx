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
import ChatMain from "./components/ChatMain";
import MessageInput from "./components/MessageInput";
import LanguageSelector, { type UiLocale } from "./components/LanguageSelector";
import Onboarding from "./components/Onboarding";
import MemoryPanel from "./components/MemoryPanel";
import { useConversations } from "./hooks/useConversations";
import { usePlaceholder } from "./hooks/usePlaceholder";
import { useMemory } from "./hooks/useMemory";
import { t } from "./i18n";
import { isWebMode } from "./webApi";

const ONBOARDING_DONE_KEY = "thinknest_onboarding_done";
const MODE_STORAGE_KEY = "thinknest_mode";

const LANG_STORAGE_KEY = "thinknest_ui_locale";

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
          setError("API недоступен. Перезапустите приложение.");
          return;
        }
        const isDev = await window.api.isDevMode();
        setDevMode(isDev);
        const currentSession = await window.api.getSession();
        setSession(currentSession);
        if (isDev || currentSession.token) {
          const currentEntitlements = await window.api.getEntitlements();
          setEntitlements(currentEntitlements);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t(uiLocale, "loadSessionFailed");
        setError(message);
      } finally {
        setLoadingSession(false);
      }
    };
    bootstrap();
  }, []);

  const refreshEntitlements = async () => {
    const current = await window.api.getEntitlements();
    setEntitlements(current);
  };

  const handleLogin = async () => {
    setError(null);
    setLoadingSession(true);
    try {
      const nextSession = await window.api.loginWithGoogle();
      setSession(nextSession);
      await refreshEntitlements();
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
  };

  const handleUpgrade = async () => {
    setError(null);
    try {
      await window.api.openCheckout();
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
      setError(t(uiLocale, "loginFirst"));
      return;
    }

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

      const preferredLocale: "ru" | "en" | "zh" = uiLocale;
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
      📱 Режим просмотра — для полной работы установите десктопное приложение
    </div>
    {showOnboarding && !isWebMode() && (
      <Onboarding
        uiLocale={uiLocale}
        onComplete={() => {
          try { localStorage.setItem(ONBOARDING_DONE_KEY, "1"); } catch {}
          setShowOnboarding(false);
        }}
      />
    )}
    <div className="app app--chat">
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
      <main className="app-main">
        <div className={`chat-topbar ${sidebarCollapsed ? "chat-topbar--sidebar-collapsed" : ""}`}>
          <button
            type="button"
            className="chat-topbar-menu"
            onClick={() => {
              if (sidebarCollapsed) {
                setSidebarCollapsed(false);
                try { localStorage.setItem("thinknest_sidebar_collapsed", "0"); } catch {}
              } else {
                setSidebarOpen(true);
              }
            }}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Menu"}
          >
            ☰
          </button>
          <div className="chat-topbar-spacer" />
          <LanguageSelector value={uiLocale} onChange={handleLocaleChange} />
        </div>
        <ChatMain
          messages={messages}
          loading={isLoadingInCurrentChat}
          maxAgents={maxAgents}
          uiLocale={uiLocale}
          streamingTokens={isLoadingInCurrentChat ? streamingTokens : {}}
        />
        <div className="app-input-wrap">
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
    </>
  );
}
