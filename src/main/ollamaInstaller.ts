import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ModelPullProgress {
  model: string;
  status: string;
  percent: number;
  done: boolean;
  error?: string;
}

/** Проверяет, установлен ли Ollama и запущен ли сервер */
export async function checkOllamaStatus(): Promise<{
  installed: boolean;
  running: boolean;
  models: string[];
}> {
  let installed = false;
  let running = false;
  let models: string[] = [];

  // Проверяем бинарник
  try {
    await execFileAsync("ollama", ["--version"]);
    installed = true;
  } catch {
    installed = false;
  }

  // Проверяем HTTP-сервер
  if (installed) {
    try {
      const res = await fetch("http://localhost:11434/api/tags", {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        running = true;
        const json = (await res.json()) as { models?: Array<{ name: string }> };
        models = (json.models ?? []).map((m) => m.name);
      }
    } catch {
      running = false;
    }
  }

  return { installed, running, models };
}

/** Запускает ollama serve в фоне */
export function startOllamaServer(): void {
  try {
    const child = spawn("ollama", ["serve"], {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
  } catch {
    // ignore — пользователь сам запустит
  }
}

/**
 * Стримит прогресс `ollama pull <model>` через callback.
 * Разбирает ndjson, который Ollama шлёт построчно.
 */
export function pullModel(
  model: string,
  onProgress: (p: ModelPullProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn("ollama", ["pull", model], { stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      return reject(e);
    }

    let buffer = "";

    const parseChunk = (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed) as {
            status?: string;
            completed?: number;
            total?: number;
          };
          const { status = "", completed = 0, total = 1 } = data;
          const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
          const done = status.toLowerCase().includes("success") ||
            status.toLowerCase().includes("already up");
          onProgress({ model, status, percent: done ? 100 : percent, done });
        } catch {
          // skip non-JSON line
        }
      }
    };

    child.stdout?.on("data", (d: Buffer) => parseChunk(d.toString()));
    child.stderr?.on("data", (d: Buffer) => parseChunk(d.toString()));

    child.on("close", (code) => {
      if (code === 0) {
        onProgress({ model, status: "success", percent: 100, done: true });
        resolve();
      } else {
        onProgress({ model, status: "error", percent: 0, done: true, error: `exit code ${code}` });
        reject(new Error(`ollama pull ${model} failed with code ${code}`));
      }
    });

    child.on("error", (e) => {
      onProgress({ model, status: "error", percent: 0, done: true, error: e.message });
      reject(e);
    });
  });
}

/** Рекомендуемые модели по профилю железа */
export const HARDWARE_PROFILES = {
  light: {
    label: "Слабый CPU (4–8 GB RAM)",
    labelEn: "Light CPU (4–8 GB RAM)",
    models: ["llama3.2:3b", "qwen2.5:3b"],
    agentModel: "llama3.2:3b",
    aggregatorModel: "llama3.2:3b"
  },
  medium: {
    label: "Средний CPU/GPU (8–16 GB)",
    labelEn: "Medium CPU/GPU (8–16 GB)",
    models: ["llama3.2:3b", "qwen2.5:3b", "deepseek-r1:7b"],
    agentModel: "llama3.2:3b",
    aggregatorModel: "llama3.2:3b"
  },
  powerful: {
    label: "Мощный GPU (16+ GB VRAM)",
    labelEn: "Powerful GPU (16+ GB)",
    models: ["llama3.2:3b", "qwen2.5:3b", "deepseek-r1:7b"],
    agentModel: "llama3.2:3b",
    aggregatorModel: "llama3.2:3b"
  }
} as const;

export type HardwareProfile = keyof typeof HARDWARE_PROFILES;
