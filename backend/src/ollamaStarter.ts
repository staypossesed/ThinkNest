import { spawn } from "node:child_process";

const OLLAMA_URL = "http://localhost:11434/api/tags";

async function isOllamaRunning(): Promise<boolean> {
  try {
    const res = await fetch(OLLAMA_URL, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Запускает ollama serve в фоне, если Ollama не отвечает */
export async function ensureOllamaStarted(): Promise<void> {
  if (await isOllamaRunning()) return;
  try {
    spawn("ollama", ["serve"], {
      detached: true,
      stdio: "ignore"
    }).unref();
  } catch {
    // ollama не найден — пользователь установит вручную
  }
}
