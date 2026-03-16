import { useEffect, useRef } from "react";
import type { AgentId, ConversationMessage, Entitlements } from "../../shared/types";
import type { UiLocale } from "./LanguageSelector";
import AgentCard from "./AgentCard";
import FinalAnswer from "./FinalAnswer";
import SkeletonAgent from "./SkeletonAgent";
import { t } from "../i18n";

const agentOrder: AgentId[] = ["planner", "critic", "pragmatist", "explainer"];

function getEffectiveMaxAgents(msg: ConversationMessage, entitlements: Entitlements | null): number {
  return msg.deepResearchMode ? (entitlements?.maxAgents ?? 2) : 1;
}

interface ChatMainProps {
  messages: ConversationMessage[];
  loading: boolean;
  entitlements: Entitlements | null;
  scrollToBottom?: boolean;
  uiLocale: UiLocale;
  streamingTokens?: Record<string, string>;
}

/** First agent currently receiving tokens */
function getActiveStreamingAgent(streamingTokens: Record<string, string>): AgentId | null {
  for (const id of agentOrder) {
    if (streamingTokens[id]) return id;
  }
  return null;
}

export default function ChatMain({
  messages,
  loading,
  entitlements,
  scrollToBottom = true,
  uiLocale,
  streamingTokens = {}
}: ChatMainProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeAgentId = getActiveStreamingAgent(streamingTokens);

  useEffect(() => {
    if (scrollToBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, streamingTokens, scrollToBottom]);

  if (messages.length === 0 && !loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <h2 className="mb-3 text-2xl font-bold text-white">{t(uiLocale, "welcomeTitle")}</h2>
          <p className="text-gray-400">{t(uiLocale, "welcomeText")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="scrollbar-chat flex-1 overflow-y-auto px-6 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-4">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-purple-600 px-5 py-3.5 text-white shadow-lg">
                {msg.images && msg.images.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {msg.images.map((uri, i) => (
                      <img
                        key={i}
                        src={uri}
                        alt=""
                        className="h-20 w-20 rounded-lg object-cover ring-1 ring-white/20"
                      />
                    ))}
                  </div>
                )}
                <p className="text-[0.95rem] leading-relaxed">{msg.question}</p>
              </div>
            </div>

            {/* AI block */}
            <div className="animate-card-in rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
              {msg.deepResearchMode && (
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t(uiLocale, "perspectivesHeaderN", {
                    n: getEffectiveMaxAgents(msg, entitlements)
                  })}
                </p>
              )}
              <div className="flex flex-col gap-3">
                {agentOrder.slice(0, getEffectiveMaxAgents(msg, entitlements)).map((agentId) => {
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
                        isActive={isLastMsg && loading && activeAgentId === agentId}
                      />
                    );
                  }
                  if (isLastMsg && loading) {
                    if (streamContent) {
                      return (
                        <AgentCard
                          key={agentId}
                          answer={{
                            id: agentId,
                            title: agentId,
                            content: streamContent,
                            model: "...",
                            durationMs: 0
                          }}
                          uiLocale={uiLocale}
                          streamingContent={streamContent}
                          isStreaming
                          isActive={activeAgentId === agentId}
                        />
                      );
                    }
                    return <SkeletonAgent key={agentId} />;
                  }
                  return null;
                })}
              </div>

              {/* Final Conclusion card — always show after 4 agents, uses 5th (judge) response */}
              {msg.final ? (
                <FinalAnswer
                  final={msg.final}
                  webSources={msg.webSources}
                  uiLocale={uiLocale}
                  question={msg.question}
                  answers={msg.answers}
                  perspectivesCount={msg.deepResearchMode ? getEffectiveMaxAgents(msg, entitlements) : 1}
                />
              ) : (
                msg === messages[messages.length - 1] &&
                loading &&
                msg.answers.length >= getEffectiveMaxAgents(msg, entitlements) && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-purple-500/10 px-4 py-3 text-sm text-purple-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
                    {t(uiLocale, "formingResult")}
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
      <div ref={bottomRef} className="h-4" />
    </div>
  );
}
