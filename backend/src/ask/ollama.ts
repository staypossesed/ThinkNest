export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export function getOllamaBase(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, "") || "http://localhost:11434";
}

function dataUriToBase64(dataUri: string): string {
  const m = dataUri.match(/^data:image\/[^;]+;base64,(.+)$/);
  const raw = m ? m[1] : dataUri;
  return raw.replace(/\s/g, "");
}

/** Нативный Ollama /api/chat — быстрее и надёжнее чем /v1/chat/completions */
async function nativeChat(
  ollamaBase: string,
  options: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    numPredict?: number;
    stream?: boolean;
    onToken?: (token: string) => void;
    signal: AbortSignal;
  }
): Promise<string> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    stream: options.stream ?? false,
    options: {
      temperature: options.temperature ?? 0.4,
      ...(options.numPredict != null && { num_predict: options.numPredict })
    }
  };

  const response = await fetch(`${ollamaBase}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama error ${response.status}: ${text}`);
  }

  if (options.stream && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed) as {
            message?: { content?: string };
            response?: string;
            done?: boolean;
          };
          const token = chunk.message?.content ?? chunk.response ?? "";
          if (token) {
            fullContent += token;
            options.onToken?.(token);
          }
        } catch {
          /* ignore */
        }
      }
    }
    return fullContent.trim();
  }

  const data = (await response.json()) as { message?: { content?: string } };
  return (data.message?.content ?? "").trim();
}

export async function chatCompletion(options: {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  timeoutMs: number;
  temperature?: number;
  numPredict?: number;
  onToken?: (token: string) => void;
  externalSignal?: AbortSignal | null;
}): Promise<string> {
  const ollamaBase = getOllamaBase(options.baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  const externalListener = options.externalSignal
    ? () => controller.abort(options.externalSignal!.reason)
    : null;
  if (externalListener && options.externalSignal) {
    if (options.externalSignal.aborted) {
      clearTimeout(timeout);
      controller.abort(options.externalSignal.reason);
    } else {
      options.externalSignal.addEventListener("abort", externalListener, { once: true });
    }
  }

  try {
    return await nativeChat(ollamaBase, {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
      numPredict: options.numPredict,
      stream: !!options.onToken,
      onToken: options.onToken,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
    if (externalListener && options.externalSignal) {
      options.externalSignal.removeEventListener("abort", externalListener);
    }
  }
}

/** Предзагрузка модели — держит её в памяти, первый запрос будет быстрее */
export async function preloadModel(baseUrl: string, model: string, timeoutMs = 15000): Promise<void> {
  const ollamaBase = getOllamaBase(baseUrl);
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "hi" }],
        stream: false,
        options: { num_predict: 2 },
        keep_alive: "5m"
      }),
      signal: controller.signal
    });
  } catch {
    /* preload не критичен */
  } finally {
    clearTimeout(t);
  }
}

const VISION_FALLBACK_MODELS = ["llava", "llava:7b", "llava:13b", "llava:7b-v1.5-q4_1"];

async function visionRequest(
  ollamaBase: string,
  model: string,
  prompt: string,
  imagesBase64: string[],
  signal: AbortSignal
): Promise<string> {
  const body = {
    model,
    stream: false,
    messages: [{ role: "user" as const, content: prompt, images: imagesBase64 }]
  };
  const response = await fetch(`${ollamaBase}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama vision ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = (await response.json()) as { message?: { content?: string } };
  const content = data.message?.content ?? "";
  return content.trim();
}

export async function visionChatCompletion(options: {
  baseUrl: string;
  model: string;
  prompt: string;
  images: string[];
  timeoutMs: number;
}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const ollamaBase = getOllamaBase(options.baseUrl);
  const imagesBase64 = options.images.map(dataUriToBase64);

  const modelsToTry = [options.model, ...VISION_FALLBACK_MODELS.filter((m) => m !== options.model)];

  let lastError: Error | null = null;
  for (const model of modelsToTry) {
    try {
      const content = await visionRequest(
        ollamaBase,
        model,
        options.prompt,
        imagesBase64,
        controller.signal
      );
      return content || "(пусто)";
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const isModelNotFound =
        lastError.message.includes("404") ||
        lastError.message.includes("model") ||
        lastError.message.includes("not found");
      if (!isModelNotFound) throw lastError;
    }
  }
  clearTimeout(timeout);
  throw new Error("Vision model not found. Install: ollama pull llava");
}
