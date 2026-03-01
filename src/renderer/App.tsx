import { useEffect, useMemo, useState } from "react";
import type { AgentAnswer, AskResponse, Entitlements, SessionState } from "../shared/types";

const agentOrder = ["planner", "critic", "pragmatist", "explainer"] as const;

const agentLabels: Record<(typeof agentOrder)[number], string> = {
  planner: "Планировщик",
  critic: "Критик",
  pragmatist: "Практик",
  explainer: "Объяснитель"
};

export default function App() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<AgentAnswer[]>([]);
  const [finalAnswer, setFinalAnswer] = useState<AskResponse["final"] | null>(
    null
  );
  const [useWebData, setUseWebData] = useState(false);
  const [forecastMode, setForecastMode] = useState(false);
  const [webSources, setWebSources] = useState<AskResponse["webSources"] | null>(null);
  const [session, setSession] = useState<SessionState>({ token: null, user: null });
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);

  const answerMap = useMemo(() => {
    return new Map(answers.map((answer) => [answer.id, answer]));
  }, [answers]);

  const profileName = useMemo(() => {
    if (!session.user) {
      return "Guest";
    }
    if (session.user.fullName?.trim()) {
      return session.user.fullName.trim().split(/\s+/)[0];
    }
    return session.user.email.split("@")[0];
  }, [session.user]);

  const legalHint =
    "Важно: ответы по юридическим вопросам носят информационный характер и не заменяют консультацию юриста.";

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
    setAnswers([]);
    setFinalAnswer(null);
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
    if (!trimmed || loading) {
      return;
    }
    if (!devMode && !session.token) {
      setError("Сначала войдите через Google.");
      return;
    }

    setLoading(true);
    setAnswers([]);
    setFinalAnswer(null);
    setWebSources(null);
    setError(null);

    try {
      const canAsk = await window.api.canAsk();
      setEntitlements(canAsk.entitlements);
      if (!canAsk.allowed) {
        setError(canAsk.reason ?? "Лимит исчерпан. Обновите план до Pro.");
        return;
      }

      const response = await window.api.ask(
        {
          question: trimmed,
          maxAgents: canAsk.entitlements.maxAgents,
          useWebData,
          forecastMode
        },
        (answer) => {
          setAnswers((prev) => {
            const next = prev.filter((a) => a.id !== answer.id);
            next.push(answer);
            next.sort(
              (a, b) =>
                agentOrder.indexOf(a.id) - agentOrder.indexOf(b.id)
            );
            return next;
          });
        }
      );
      setAnswers(response.answers);
      setFinalAnswer(response.final);
      setWebSources(response.webSources ?? null);
      const usage = await window.api.consumeUsage(trimmed);
      setEntitlements(usage.entitlements);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось получить ответ.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Multi Agent Desktop</h1>
        <p>Free/Pro AI-помощник: 4 агента + лучший итоговый ответ.</p>
      </header>

      <section className="card">
        <div className="topbar">
          <div>
            {devMode ? (
              <p className="meta dev-badge">
                Режим разработки: 4 агента, без лимитов. Backend не нужен.
              </p>
            ) : session.user ? (
              <>
                <p className="meta">
                  {profileName} • План: {entitlements?.plan ?? "unknown"}
                </p>
                {entitlements && (
                  <p className="meta">
                    Лимит: {entitlements.usedQuestions}/{entitlements.maxQuestions} (
                    {entitlements.remainingQuestions} осталось)
                  </p>
                )}
              </>
            ) : (
              <p className="meta">Войдите через Google, чтобы использовать Free/Pro лимиты.</p>
            )}
          </div>
          <div className="row-actions">
            {!devMode && !session.user && (
              <button type="button" onClick={handleLogin} disabled={loadingSession}>
                {loadingSession ? "Подключаю..." : "Войти через Google"}
              </button>
            )}
            {!devMode && session.user && (
              <>
                <button type="button" onClick={refreshEntitlements}>
                  Refresh plan
                </button>
                {entitlements?.plan === "free" && (
                  <button type="button" onClick={handleUpgrade}>
                    Upgrade to Pro
                  </button>
                )}
                {entitlements?.plan === "pro" && (
                  <button type="button" onClick={handleManageBilling}>
                    Manage billing
                  </button>
                )}
                <button type="button" onClick={handleLogout}>
                  Выйти
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <label className="label" htmlFor="question">
          Ваш вопрос
        </label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Например: Как быстрее убрать квартиру перед гостями?"
          rows={4}
          disabled={loading}
        />
        <div className="toggles">
          <label className="toggle">
            <input
              type="checkbox"
              checked={useWebData}
              onChange={(e) => setUseWebData(e.target.checked)}
              disabled={loading}
            />
            <span>Use Web Data</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={forecastMode}
              onChange={(e) => setForecastMode(e.target.checked)}
              disabled={loading}
            />
            <span>Режим прогнозирования</span>
          </label>
        </div>
        <div className="actions">
          <button
            type="button"
            onClick={submit}
            disabled={loading || question.trim().length === 0}
          >
            {loading
              ? answers.length >= (entitlements?.maxAgents ?? 4)
                ? "Формирую итог..."
                : answers.length > 0
                  ? `${agentLabels[agentOrder[answers.length]]} отвечает...`
                  : "Планировщик отвечает..."
              : "Спросить"}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        <div className="hint">{legalHint}</div>
      </section>

      <section className="grid">
        {agentOrder.map((agentId, idx) => {
          const maxAgents = entitlements?.maxAgents ?? 2;
          const isEnabled = idx < maxAgents;
          const answer = answerMap.get(agentId);
          return (
            <article key={agentId} className="card">
              <h2>
                {agentLabels[agentId]} {!isEnabled && <span className="pill">Pro</span>}
              </h2>
              {!isEnabled && (
                <p className="muted">Доступно в плане Pro (4 агента вместо 2).</p>
              )}
              {loading && !answer && (
                <p className="muted">Агент думает...</p>
              )}
              {!loading && !answer && <p className="muted">Нет ответа.</p>}
              {answer && (
                <>
                  <p className="meta">
                    Модель: {answer.model} • {answer.durationMs} мс
                  </p>
                  <p className="content">{answer.content}</p>
                </>
              )}
            </article>
          );
        })}
      </section>

      <section className="card final">
        <h2>Итоговый ответ</h2>
        {loading && <p className="muted">Формирую итог...</p>}
        {!loading && !finalAnswer && <p className="muted">Пока нет ответа.</p>}
        {finalAnswer && (
          <>
            <p className="meta">
              Модель: {finalAnswer.model} • {finalAnswer.durationMs} мс
            </p>
            <p className="content">{finalAnswer.content}</p>
          </>
        )}
        {webSources && webSources.results.length > 0 && (
          <div className="sources">
            <h3>Веб-источники</h3>
            <ul>
              {webSources.results.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="source-link"
                    onClick={() => window.api.openExternal(s.url)}
                  >
                    {s.title || s.url}
                  </button>
                  {s.snippet && <span className="source-snippet">{s.snippet.slice(0, 120)}…</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
