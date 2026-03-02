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
import { useConversations } from "./hooks/useConversations";
import { usePlaceholder } from "./hooks/usePlaceholder";

const LANG_STORAGE_KEY = "thinknest_ui_locale";

function detectSystemLocale(): UiLocale {
  if (typeof navigator === "undefined") return "ru";
  const lang = (navigator.language ?? navigator.languages?.[0] ?? "").toLowerCase();
  if (/^(ru|uk|be)/.test(lang)) return "ru";
  if (/^zh/.test(lang)) return "zh";
  return "en";
}

const agentOrder = ["planner", "critic", "pragmatist", "explainer"] as const;
const agentLabels: Record<(typeof agentOrder)[number], string> = {
  planner: "Планировщик",
  critic: "Критик",
  pragmatist: "Практик",
  explainer: "Объяснитель"
};

export default function App() {
  const [question, setQuestion] = useState("");
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [useWebData, setUseWebData] = useState(false);
  const [forecastMode, setForecastMode] = useState(false);
  const [session, setSession] = useState<SessionState>({ token: null, user: null });
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const [uiLocale, setUiLocale] = useState<UiLocale>(() => {
    try {
      const s = localStorage.getItem(LANG_STORAGE_KEY);
      if (s === "ru" || s === "en" || s === "zh") return s;
    } catch {}
    return detectSystemLocale();
  });

  const answersRef = useRef<AgentAnswer[]>([]);

  const handleLocaleChange = (locale: UiLocale) => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, locale);
    } catch {}
    flushSync(() => setUiLocale(locale));
    if (loading) {
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

  const messages = activeConversation?.messages ?? [];
  const maxAgents = entitlements?.maxAgents ?? 4;
  const inputPlaceholder = usePlaceholder(uiLocale);

  const statusText = useMemo(() => {
    if (!loading) return "";
    if (messages.length === 0) return "Планировщик отвечает...";
    const last = messages[messages.length - 1];
    const count = last?.answers.length ?? 0;
    if (count >= maxAgents) return "Формирую итог...";
    return `${agentLabels[agentOrder[count]]} отвечает...`;
  }, [loading, messages, maxAgents]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
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
          err instanceof Error ? err.message : "Не удалось загрузить сессию.";
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
      const message = err instanceof Error ? err.message : "Ошибка входа через Google.";
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
      const message = err instanceof Error ? err.message : "Не удалось открыть оплату.";
      setError(message);
    }
  };

  const handleManageBilling = async () => {
    setError(null);
    try {
      await window.api.openPortal();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось открыть управление подпиской.";
      setError(message);
    }
  };

  const submit = async () => {
    const trimmed = question.trim();
    const hasContent = trimmed || attachedImages.length > 0;
    if (!hasContent || loading) return;
    if (!devMode && !session.token) {
      setError("Сначала войдите через Google.");
      return;
    }

    const questionText =
      trimmed ||
      (attachedImages.length > 0
        ? "[Изображение]"
        : "");
    setLoading(true);
    setError(null);

    let conv: { id: string };
    let placeholder: ConversationMessage;
    if (!activeConversation) {
      const result = createConversationWithFirstMessage(questionText, {
        useWebData,
        forecastMode,
        images: attachedImages.length > 0 ? attachedImages : undefined
      });
      conv = result.conv;
      placeholder = result.placeholder;
    } else {
      conv = activeConversation;
      placeholder = addMessagePlaceholder(conv.id, questionText, {
        useWebData,
        forecastMode,
        images: attachedImages.length > 0 ? attachedImages : undefined
      });
    }

    answersRef.current = [];

    try {
      const canAsk = await window.api.canAsk();
      setEntitlements(canAsk.entitlements);
      if (!canAsk.allowed) {
        setError(canAsk.reason ?? "Лимит исчерпан. Обновите план до Pro.");
        setLoading(false);
        return;
      }

      const preferredLocale: "ru" | "en" | "zh" = uiLocale;

      const response = await window.api.ask(
        {
          question: questionText,
          maxAgents: canAsk.entitlements.maxAgents,
          useWebData,
          forecastMode,
          preferredLocale,
          images: attachedImages.length > 0 ? attachedImages : undefined
        },
        (answer: AgentAnswer) => {
          answersRef.current = answersRef.current.filter((a) => a.id !== answer.id);
          answersRef.current.push(answer);
          answersRef.current.sort(
            (a, b) => agentOrder.indexOf(a.id) - agentOrder.indexOf(b.id)
          );
          updateMessage(conv.id, placeholder.id, {
            answers: [...answersRef.current]
          });
        }
      );

      updateMessage(conv.id, placeholder.id, {
        answers: response.answers,
        final: response.final,
        webSources: response.webSources ?? null
      });

      const usage = await window.api.consumeUsage(questionText);
      setEntitlements(usage.entitlements);
      setQuestion("");
      setAttachedImages([]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось получить ответ.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    newChat();
    setQuestion("");
    setAttachedImages([]);
    setError(null);
  };

  return (
    <div className="app app--chat">
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={selectConversation}
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
      />
      <main className="app-main">
        <div className="chat-topbar">
          <div className="chat-topbar-spacer" />
          <LanguageSelector value={uiLocale} onChange={handleLocaleChange} />
        </div>
        <ChatMain
          messages={messages}
          loading={loading}
          maxAgents={maxAgents}
        />
        <div className="app-input-wrap">
          <MessageInput
            value={question}
            onChange={setQuestion}
            onSubmit={submit}
            loading={loading}
            disabled={!devMode && !session.token}
            useWebData={useWebData}
            forecastMode={forecastMode}
            onUseWebDataChange={setUseWebData}
            onForecastModeChange={setForecastMode}
            statusText={statusText}
            error={error}
            placeholder={inputPlaceholder}
            images={attachedImages}
            onImagesChange={setAttachedImages}
          />
        </div>
      </main>
    </div>
  );
}
