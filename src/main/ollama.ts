export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
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
