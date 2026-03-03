export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Извлекает base URL без /v1 для нативного Ollama API */
function getOllamaBase(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, "") || "http://localhost:11434";
}

/** Data URI (data:image/png;base64,...) → raw base64 для Ollama */
function dataUriToBase64(dataUri: string): string {
  const m = dataUri.match(/^data:image\/[^;]+;base64,(.+)$/);
  const raw = m ? m[1] : dataUri;
  return raw.replace(/\s/g, "");
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function chatCompletion(options: {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  timeoutMs: number;
  temperature?: number;
  /** Ограничить длину ответа (быстрее для медленных моделей) */
  numPredict?: number;
  /** Streaming: вызывается для каждого нового кусочка текста */
  onToken?: (token: string) => void;
  /** Внешний сигнал остановки (от пользователя) */
  externalSignal?: AbortSignal | null;
}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  // Слушаем внешний сигнал (кнопка Stop)
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

  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.4,
    stream: !!options.onToken
  };
  if (options.numPredict != null) {
    body.options = { num_predict: options.numPredict };
  }

  try {
    const response = await fetch(`${options.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error ${response.status}: ${text}`);
    }

    // Streaming mode: читаем SSE построчно
    if (options.onToken && response.body) {
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
          if (!trimmed || trimmed === "data: [DONE]") continue;
          const jsonStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;
          try {
            const chunk = JSON.parse(jsonStr) as {
              choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
            };
            const token = chunk.choices?.[0]?.delta?.content ?? "";
            if (token) {
              fullContent += token;
              options.onToken(token);
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }
      return fullContent.trim();
    }

    // Non-streaming mode
    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content ?? "";
    return content.trim();
  } finally {
    clearTimeout(timeout);
    if (externalListener && options.externalSignal) {
      options.externalSignal.removeEventListener("abort", externalListener);
    }
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
    messages: [
      { role: "user" as const, content: prompt, images: imagesBase64 }
    ]
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

/** Vision: распознавание картинок через нативный Ollama /api/chat (llava и т.п.) */
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
  throw new Error(
    `Vision-модель не найдена. Установите: ollama pull llava`
  );
}
