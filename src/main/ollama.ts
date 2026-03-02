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
}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  const body: Record<string, unknown> = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.4
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

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content ?? "";
    return content.trim();
  } finally {
    clearTimeout(timeout);
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
