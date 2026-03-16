import { useState, useCallback } from "react";

const MEMORY_KEY = "thinknest_user_memory";

export interface UserMemory {
  name: string;
  profession: string;
  interests: string;
  language: string;
  additionalContext: string;
}

const EMPTY_MEMORY: UserMemory = {
  name: "",
  profession: "",
  interests: "",
  language: "",
  additionalContext: ""
};

function loadMemory(): UserMemory {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return EMPTY_MEMORY;
    return { ...EMPTY_MEMORY, ...(JSON.parse(raw) as Partial<UserMemory>) };
  } catch {
    return EMPTY_MEMORY;
  }
}

function saveMemory(m: UserMemory): void {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(m));
  } catch {}
}

/** Строит строку контекста для вставки в системный промпт */
export function buildMemoryContext(m: UserMemory): string {
  const parts: string[] = [];
  if (m.name) parts.push(`Имя пользователя: ${m.name}`);
  if (m.profession) parts.push(`Профессия/роль: ${m.profession}`);
  if (m.interests) parts.push(`Интересы/специализация: ${m.interests}`);
  if (m.language) parts.push(`Предпочтительный язык общения: ${m.language}`);
  if (m.additionalContext) parts.push(`Дополнительный контекст: ${m.additionalContext}`);
  if (parts.length === 0) return "";
  return "[КОНТЕКСТ О ПОЛЬЗОВАТЕЛЕ — ОБЯЗАТЕЛЬНО ИСПОЛЬЗУЙ ДЛЯ ВОПРОСОВ О ПОЛЬЗОВАТЕЛЕ]\n" + parts.join("\n");
}

export function useMemory() {
  const [memory, setMemoryState] = useState<UserMemory>(loadMemory);

  const setMemory = useCallback((updates: Partial<UserMemory>) => {
    setMemoryState((prev) => {
      const next = { ...prev, ...updates };
      saveMemory(next);
      return next;
    });
  }, []);

  const memoryContext = buildMemoryContext(memory);

  return { memory, setMemory, memoryContext };
}
