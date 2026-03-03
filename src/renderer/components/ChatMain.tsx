import { useEffect, useRef } from "react";
import type { AgentId, ConversationMessage } from "../../shared/types";
import type { UiLocale } from "./LanguageSelector";
import AgentCard from "./AgentCard";
import FinalAnswer from "./FinalAnswer";
import SkeletonAgent from "./SkeletonAgent";
import { t } from "../i18n";

const agentOrder: AgentId[] = ["planner", "critic", "pragmatist", "explainer"];

interface ChatMainProps {
  messages: ConversationMessage[];
  loading: boolean;
  maxAgents: number;
  scrollToBottom?: boolean;
  uiLocale: UiLocale;
  streamingTokens?: Record<string, string>;
}

export default function ChatMain({
  messages,
  loading,
  maxAgents,
  scrollToBottom = true,
  uiLocale,
  streamingTokens = {}
}: ChatMainProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollToBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, streamingTokens, scrollToBottom]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="chat-main chat-main--empty">
        <div className="chat-main-welcome">
          <h2>{t(uiLocale, "welcomeTitle")}</h2>
          <p>{t(uiLocale, "welcomeText")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-main">
      <div className="chat-main-messages">
        {messages.map((msg) => (
          <div key={msg.id} className="chat-main-exchange">
            <div className="message-bubble message-bubble--user">
              {msg.images && msg.images.length > 0 && (
                <div className="message-bubble-images">
                  {msg.images.map((uri, i) => (
                    <img key={i} src={uri} alt="" className="message-bubble-image" />
                  ))}
                </div>
              )}
              {msg.question}
            </div>
            <div className="message-bubble message-bubble--ai">
              <div className="ai-block-header">{t(uiLocale, "expertsRespond")}</div>
              <div className="ai-block-agents">
                {agentOrder.slice(0, maxAgents).map((agentId) => {
                  const answer = msg.answers.find((a) => a.id === agentId);
                  const isLastMsg = msg === messages[messages.length - 1];
                  const streamContent = isLastMsg ? streamingTokens[agentId] : undefined;
                  const isStreaming = isLastMsg && loading && !!streamContent && !answer?.content;

                  if (answer) {
                    return (
                      <AgentCard
                        key={agentId}
                        answer={answer}
                        uiLocale={uiLocale}
                        streamingContent={isLastMsg && loading ? streamContent : undefined}
                        isStreaming={isStreaming}
                      />
                    );
                  }
                  if (isLastMsg && loading) {
                    if (streamContent) {
                      // Show streaming card before answer is finalized
                      return (
                        <AgentCard
                          key={agentId}
                          answer={{ id: agentId, title: agentId, content: streamContent, model: "...", durationMs: 0 }}
                          uiLocale={uiLocale}
                          streamingContent={streamContent}
                          isStreaming
                        />
                      );
                    }
                    return <SkeletonAgent key={agentId} />;
                  }
                  return null;
                })}
              </div>
              {msg.final ? (
                <FinalAnswer
                  final={msg.final}
                  webSources={msg.webSources}
                  uiLocale={uiLocale}
                  question={msg.question}
                  answers={msg.answers}
                />
              ) : (
                msg === messages[messages.length - 1] &&
                loading &&
                msg.answers.length >= maxAgents && (
                  <div className="final-answer-loading">{t(uiLocale, "formingResult")}</div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
      <div ref={bottomRef} className="chat-main-anchor" />
    </div>
  );
}
