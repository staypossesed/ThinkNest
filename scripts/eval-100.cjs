/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const { chatCompletion } = require("../dist/main/ollama.js");
const { ollamaConfig } = require("../dist/main/config.js");
const { searchWeb, formatWebContext } = require("../dist/main/webSearch.js");

function dbg() {
  /* no-op для публичного репо */
}

function roleAdherence(agentId, content) {
  const t = (content || "").toLowerCase();
  if (agentId === "critic") return /риск|неточност|провер/.test(t) ? 1 : 0;
  if (agentId === "planner") return /1\)|1\.|шаг/.test(t) ? 1 : 0;
  if (agentId === "pragmatist") return /что делать|чек-?лист|шаг|практич/.test(t) ? 1 : 0;
  return /прост|пример|аналог/.test(t) ? 1 : 0;
}

function isDirectQuestion(q) {
  return /кто.*лучше|лучший|best|кому.*обрат|к кому.*обрат|who to contact|кто сейчас/i.test(q);
}

function buildQuestions() {
  const factual = [
    "Кто президент США сейчас?",
    "Кто премьер-министр Великобритании сейчас?",
    "Кто сейчас глава OpenAI?",
    "Какая столица Австралии?",
    "Когда запустили ChatGPT?"
  ];
  const direct = [
    "Кто сейчас лучший вайб кодер?",
    "К кому обратиться за помощью по React архитектуре?",
    "Кто лучший эксперт по Rust backend?",
    "Who is the best AI coding mentor now?",
    "Кто лучше всего объясняет системный дизайн?"
  ];
  const practical = [
    "Как быстро настроить CI/CD для Node проекта?",
    "Как сократить latency в REST API?",
    "Как выбрать мониторинг для продакшена?",
    "Как проверить утечки памяти в Electron?",
    "Как улучшить стабильность Ollama на локальной машине?"
  ];
  const compare = [
    "Что лучше для RAG: pgvector или Weaviate?",
    "Что выбрать для фронта: React или Vue для админки?",
    "Что лучше для кэша: Redis или Memcached?",
    "Что лучше для логов: Loki или ELK?",
    "Что выбрать для бэкапа Postgres в облаке?"
  ];

  const all = [];
  for (let i = 0; i < 5; i++) {
    for (const q of factual) all.push(`${q} [test ${i + 1}]`);
    for (const q of direct) all.push(`${q} [test ${i + 1}]`);
    for (const q of practical) all.push(`${q} [test ${i + 1}]`);
    for (const q of compare) all.push(`${q} [test ${i + 1}]`);
  }
  return all.slice(0, 100);
}

const ROLE_PROMPTS = [
  {
    id: "planner",
    model: ollamaConfig.agents.planner,
    numPredict: 260,
    system:
      "Ты Планировщик. Формат: краткий ответ, затем 3 шага, затем итог. Без раздела рисков."
  },
  {
    id: "critic",
    model: ollamaConfig.agents.critic,
    numPredict: 220,
    system:
      "Ты Критик. Формат: краткий вердикт, затем 2+ риска/неточности, затем что проверить."
  },
  {
    id: "pragmatist",
    model: ollamaConfig.agents.pragmatist,
    numPredict: 200,
    system:
      "Ты Практик. Формат: практический вывод, 2-4 шага действий, короткий чек-лист."
  },
  {
    id: "explainer",
    model: ollamaConfig.agents.explainer,
    numPredict: 180,
    system:
      "Ты Объяснитель. Формат: простое объяснение, мини-пример/аналогия, короткий вывод."
  }
];

async function main() {
  const questions = buildQuestions();
  const byAgent = {
    planner: { count: 0, errors: 0, avgLen: 0, water: 0, noInfo: 0, roleOk: 0 },
    critic: { count: 0, errors: 0, avgLen: 0, water: 0, noInfo: 0, roleOk: 0 },
    pragmatist: { count: 0, errors: 0, avgLen: 0, water: 0, noInfo: 0, roleOk: 0 },
    explainer: { count: 0, errors: 0, avgLen: 0, water: 0, noInfo: 0, roleOk: 0 }
  };
  const fails = [];

  dbg("eval-100:start", "starting evaluation", { total: questions.length }, "H23");

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const role = ROLE_PROMPTS[i % ROLE_PROMPTS.length];
    try {
      const results = await searchWeb([question]);
      const webContext = formatWebContext(results);
      const userContent =
        (webContext ? `${webContext}\n\n---\n` : "") +
        `Вопрос: ${question}\n\nОтвечай кратко и по сути, без воды.`;

      const content = await chatCompletion({
        baseUrl: ollamaConfig.baseUrl,
        model: role.model,
        timeoutMs: Math.min(90000, ollamaConfig.timeoutMs),
        temperature: 0.3,
        numPredict: role.numPredict,
        messages: [
          { role: "system", content: role.system },
          { role: "user", content: userContent }
        ]
      });

      const m = byAgent[role.id];
      m.count += 1;
      const len = (content || "").length;
      m.avgLen += len;
      const direct = isDirectQuestion(question);
      if (direct && len > 600) m.water += 1;
      if (/в найденных источниках не указано|нет точных данных|not specified/i.test(content || "")) m.noInfo += 1;
      if ((content || "").startsWith("Ошибка агента:")) m.errors += 1;
      m.roleOk += roleAdherence(role.id, content || "");

      if ((i + 1) % 10 === 0) {
        console.log(`Completed ${i + 1}/100`);
        dbg("eval-100:progress", "batch progress", { done: i + 1 }, "H24");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      fails.push({ index: i, question, error: msg });
      byAgent[role.id].errors += 1;
      dbg("eval-100:question-fail", "single model eval failed", { index: i, role: role.id, msg }, "H25");
    }
  }

  for (const id of Object.keys(byAgent)) {
    const m = byAgent[id];
    m.avgLen = m.count ? Math.round(m.avgLen / m.count) : 0;
    m.roleOk = m.count ? Number((m.roleOk / m.count).toFixed(3)) : 0;
  }

  const report = {
    runId: RUN_ID,
    finishedAt: new Date().toISOString(),
    totals: { questions: questions.length, failedQuestions: fails.length },
    byAgent,
    failedQuestions: fails.slice(0, 20)
  };

  fs.writeFileSync(
    path.join(process.cwd(), "eval-100-report.pre.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );
  dbg("eval-100:done", "evaluation done", report.totals, "H25");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : "unknown";
  dbg("eval-100:fatal", "fatal error", { msg }, "H25");
  console.error(err);
  process.exit(1);
});
