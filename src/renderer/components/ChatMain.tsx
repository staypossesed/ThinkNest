import { useEffect, useRef } from "react";
import type { AgentId, ConversationMessage } from "../../shared/types";
import AgentCard from "./AgentCard";
import FinalAnswer from "./FinalAnswer";
import SkeletonAgent from "./SkeletonAgent";

const agentOrder: AgentId[] = ["planner", "critic", "pragmatist", "explainer"];

interface ChatMainProps {
  messages: ConversationMessage[];
  loading: boolean;
  maxAgents: number;
  scrollToBottom?: boolean;
}

export default function ChatMain({
  messages,
  loading,
  maxAgents,
  scrollToBottom = true
}: ChatMainProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollToBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, scrollToBottom]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="chat-main chat-main--empty">
        <div className="chat-main-welcome">
          <h2>Multi Agent Desktop</h2>
          <p>4 эксперта отвечают на ваш вопрос. Задайте вопрос или начните новый чат.</p>
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
              <div className="ai-block-header">4 эксперта отвечают</div>
              <div className="ai-block-agents">
                {agentOrder.slice(0, maxAgents).map((agentId) => {
                  const answer = msg.answers.find((a) => a.id === agentId);
                  if (answer) {
                    return <AgentCard key={agentId} answer={answer} />;
                  }
                  const isLastAndLoading = msg === messages[messages.length - 1] && loading;
                  return isLastAndLoading ? (
                    <SkeletonAgent key={agentId} />
                  ) : null;
                })}
              </div>
              {msg.final ? (
                <FinalAnswer final={msg.final} webSources={msg.webSources} />
              ) : (
                msg === messages[messages.length - 1] &&
                loading &&
                msg.answers.length >= maxAgents && (
                  <div className="final-answer-loading">Формирую итог...</div>
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
