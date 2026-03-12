"use strict";

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const PORT = Number(process.env.PORT) || 3000;

const GLOBAL_RULE =
  "ТЫ — эксперт. " +
  "1. Определи язык вопроса пользователя. " +
  "2. Отвечай ТОЛЬКО на языке вопроса. Никогда не меняй язык. " +
  "3. Думай шаг за шагом (chain-of-thought) внутри себя, но отвечай кратко и по делу. " +
  "4. Если не уверен в факте — скажи «Не знаю точно» или «Рекомендую проверить». Никогда не выдумывай. " +
  "5. Будь максимально точным, полезным и профессиональным.";

const AGENTS = [
  {
    id: "strategist",
    title: "Strategist",
    model: "llama3.2:3b",
    systemPrompt:
      GLOBAL_RULE +
      "\n\n=== AGENT 1: Strategist (🎯) ===\n" +
      "Ты — Strategist. Даёшь стратегическое видение и лучшие практики. " +
      "Используй глобальное правило выше. " +
      "Структура ответа: " +
      "1. Ключевой вывод " +
      "2. Почему это важно " +
      "3. Что делать дальше (конкретные шаги)"
  },
  {
    id: "skeptic",
    title: "Skeptic",
    model: "qwen2.5:3b",
    systemPrompt:
      GLOBAL_RULE +
      "\n\n=== AGENT 2: Skeptic (🔍) ===\n" +
      "Ты — Skeptic. Ищешь слабые места, риски и логические ошибки. " +
      "Используй глобальное правило выше. " +
      "Отвечай честно: что может пойти не так и как это исправить."
  },
  {
    id: "practitioner",
    title: "Practitioner",
    model: "llama3.2:3b",
    systemPrompt:
      GLOBAL_RULE +
      "\n\n=== AGENT 3: Practitioner (⚡) ===\n" +
      "Ты — Practitioner. Даёшь практические шаги, инструменты и готовые решения. " +
      "Используй глобальное правило выше. " +
      "Всегда заканчивай готовым планом действий."
  },
  {
    id: "explainer",
    title: "Explainer",
    model: "qwen2.5:3b",
    systemPrompt:
      GLOBAL_RULE +
      "\n\n=== AGENT 4: Explainer (💡) ===\n" +
      "Ты — Explainer. Объясняешь просто и понятно. " +
      "Используй глобальное правило выше. " +
      "Особенно внимательно работай с датами и числами — считай шаг за шагом. Никогда не пиши неверные даты вроде \"2 февраля 29\"."
  }
];

const JUDGE_PROMPT =
  "Ты — Final Conclusion Agent. " +
  "Твоя задача — прочитать ответы всех 4 агентов и выдать ОДИН лучший, точный и красивый ответ.\n\n" +
  "Правила:\n" +
  "- Отвечай строго на языке вопроса пользователя.\n" +
  "- Возьми лучшее из всех 4 ответов.\n" +
  "- Исправь все ошибки и галлюцинации 4 агентов.\n" +
  "- Сделай ответ коротким, структурированным и готовым к использованию.\n" +
  "- Начинай сразу с главного ответа (без преамбул).\n" +
  "- Если нужно — добавь важное предупреждение.\n\n" +
  "Формат вывода: напиши сразу итоговый ответ. Без WINNER/REASON — только сам текст ответа.";

async function ollamaChat(ollamaBase, { model, messages, stream = false }) {
  const body = {
    model,
    messages,
    stream,
    options: { temperature: 0.3, top_p: 0.9, num_predict: 140 }
  };
  const res = await fetch(`${ollamaBase}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama ${res.status}: ${text}`);
  }
  return res;
}

async function ollamaChatNonStream(ollamaBase, model, messages) {
  const res = await ollamaChat(ollamaBase, { model, messages, stream: false });
  const data = await res.json();
  return (data.message?.content ?? "").trim();
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "thinknest-server" });
});

app.post("/api/chat", async (req, res) => {
  const question = (req.body?.message ?? req.body?.question ?? "").trim();
  if (!question) {
    return res.status(400).json({ error: "message or question is required" });
  }

  const ollamaBase = OLLAMA_HOST.replace(/\/v1\/?$/, "") || "http://127.0.0.1:11434";

  try {
    const agentAnswers = [];
    for (const agent of AGENTS) {
      const content = await ollamaChatNonStream(ollamaBase, agent.model, [
        { role: "system", content: agent.systemPrompt },
        { role: "user", content: question }
      ]);
      agentAnswers.push(`=== ${agent.title} ===\n${content}`);
    }

    const judgeContext = agentAnswers.join("\n\n");
    const judgeMessages = [
      { role: "system", content: JUDGE_PROMPT },
      {
        role: "user",
        content: `Вопрос пользователя:\n${question}\n\nОтветы 4 агентов:\n\n${judgeContext}\n\nДай итоговый ответ.`
      }
    ];

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");

    const judgeRes = await ollamaChat(ollamaBase, {
      model: "llama3.2:3b",
      messages: judgeMessages,
      stream: true
    });

    if (!judgeRes.body) {
      return res.status(500).send("Stream not available");
    }

    const reader = judgeRes.body.getReader();
    const decoder = new TextDecoder();
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
          const chunk = JSON.parse(trimmed);
          const token = chunk.message?.content ?? chunk.response ?? "";
          if (token) res.write(token);
        } catch {
          /* ignore */
        }
      }
    }
    res.end();
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Chat failed" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ThinkNest server listening on port ${PORT}`);
});
