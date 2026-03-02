import { useCallback, useEffect, useState } from "react";
import type {
  AgentAnswer,
  AskResponse,
  AskResponseSources,
  Conversation,
  ConversationMessage
} from "../../shared/types";

const STORAGE_KEY_PROD = "thinknest_conversations";
const STORAGE_KEY_DEV = "thinknest_conversations_dev";
const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVERSATION = 100;

function getStorageKey(devMode: boolean): string {
  return devMode ? STORAGE_KEY_DEV : STORAGE_KEY_PROD;
}

function loadConversations(devMode: boolean): Conversation[] {
  try {
    const key = getStorageKey(devMode);
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversations(devMode: boolean, conversations: Conversation[]): void {
  try {
    const key = getStorageKey(devMode);
    localStorage.setItem(key, JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)));
  } catch {
    // ignore
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function useConversations(devMode: boolean) {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations(false)
  );
  const [activeId, setActiveId] = useState<string | null>(() => {
    const loaded = loadConversations(false);
    return loaded.length > 0 ? loaded[0].id : null;
  });

  useEffect(() => {
    const loaded = loadConversations(devMode);
    setConversations(loaded);
    setActiveId(loaded.length > 0 ? loaded[0].id : null);
  }, [devMode]);

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  const persistWithLatest = useCallback(
    (updater: (prev: Conversation[]) => Conversation[]) => {
      setConversations((prev) => {
        const next = updater(prev);
        saveConversations(devMode, next);
        return next;
      });
    },
    [devMode]
  );

  const createConversation = useCallback((): Conversation => {
    const id = generateId();
    const now = Date.now();
    const conv: Conversation = {
      id,
      messages: [],
      createdAt: now,
      updatedAt: now
    };
    persistWithLatest((prev) => [conv, ...prev.filter((c) => c.id !== id)]);
    setActiveId(id);
    return conv;
  }, [persistWithLatest]);

  /** Атомарно создаёт чат и добавляет первое сообщение (избегает гонки state) */
  const createConversationWithFirstMessage = useCallback(
    (
      question: string,
      options?: { useWebData?: boolean; forecastMode?: boolean; images?: string[] }
    ): { conv: Conversation; placeholder: ConversationMessage } => {
      const id = generateId();
      const now = Date.now();
      const placeholder: ConversationMessage = {
        id: generateId(),
        question,
        timestamp: now,
        answers: [],
        final: null,
        webSources: null,
        useWebData: options?.useWebData,
        forecastMode: options?.forecastMode,
        images: options?.images
      };
      const conv: Conversation = {
        id,
        messages: [placeholder],
        createdAt: now,
        updatedAt: now
      };
      persistWithLatest((prev) => [conv, ...prev.filter((c) => c.id !== id)]);
      setActiveId(id);
      return { conv, placeholder };
    },
    [persistWithLatest]
  );

  const addMessagePlaceholder = useCallback(
    (
      convId: string,
      question: string,
      options?: { useWebData?: boolean; forecastMode?: boolean; images?: string[] }
    ): ConversationMessage => {
      const msg: ConversationMessage = {
        id: generateId(),
        question,
        timestamp: Date.now(),
        answers: [],
        final: null,
        webSources: null,
        useWebData: options?.useWebData,
        forecastMode: options?.forecastMode,
        images: options?.images
      };
      persistWithLatest((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          const messages = [...c.messages, msg].slice(-MAX_MESSAGES_PER_CONVERSATION);
          return { ...c, messages, updatedAt: Date.now() };
        })
      );
      return msg;
    },
    [persistWithLatest]
  );

  const updateMessage = useCallback(
    (
      convId: string,
      messageId: string,
      updates: {
        answers?: AgentAnswer[];
        final?: AskResponse["final"] | null;
        webSources?: AskResponseSources | null;
      }
    ) => {
      persistWithLatest((prev) =>
        prev.map((c) => {
          if (c.id !== convId) return c;
          const messages = c.messages.map((m) => {
            if (m.id !== messageId) return m;
            return {
              ...m,
              answers: updates.answers ?? m.answers,
              final: updates.final !== undefined ? updates.final : m.final,
              webSources: updates.webSources !== undefined ? updates.webSources : m.webSources
            };
          });
          return { ...c, messages, updatedAt: Date.now() };
        })
      );
    },
    [persistWithLatest]
  );

  const selectConversation = useCallback((id: string | null) => {
    setActiveId(id);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      const wasActive = activeId === id;
      persistWithLatest((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (wasActive) {
          queueMicrotask(() => setActiveId(next[0]?.id ?? null));
        }
        return next;
      });
    },
    [activeId, persistWithLatest]
  );

  const newChat = useCallback(() => {
    return createConversation();
  }, [createConversation]);

  return {
    conversations,
    activeId,
    activeConversation,
    createConversation,
    createConversationWithFirstMessage,
    addMessagePlaceholder,
    updateMessage,
    selectConversation,
    deleteConversation,
    newChat
  };
}
