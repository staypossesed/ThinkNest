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
  return m ? m[1] : dataUri;
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

  const body = {
    model: options.model,
    stream: false,
    messages: [
      {
        role: "user",
        content: options.prompt,
        images: imagesBase64
      }
    ]
  };

  try {
    const response = await fetch(`${ollamaBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama vision error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    const content = data.message?.content ?? "";
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}
