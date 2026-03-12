# ThinkNest

Desktop и веб-приложение с 4 AI-агентами (Strategist, Skeptic, Practitioner, Explainer) и итоговым ответом. Работает локально через Ollama.

## Стек

- **Desktop:** Electron + React + TypeScript
- **Backend (web):** Fastify + Supabase + Stripe + Google OAuth
- **Server (VPS):** Express — простой API для деплоя
- **LLM:** Ollama

---

## Требования

- Node.js LTS
- Ollama

---

## Установка

```bash
npm install
npm --prefix backend install
```

### Модели Ollama

**Минимум (4 агента):**
```bash
ollama pull llama3.2:3b
ollama pull qwen2.5:3b
```

**Опционально (картинки, Deep Research):**
```bash
ollama pull deepseek-r1:7b   # для режима Practitioner
ollama pull llava   # распознавание картинок
```

> `ollama pull` принимает только одну модель за раз.

---

## Переменные окружения

### 1. Backend (web-режим с Google, Stripe)

```bash
cp backend/.env.example backend/.env
```

Заполни: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `APP_JWT_SECRET`.

### 2. Desktop (корень)

```bash
cp .env.example .env
```

Опционально: `SERPER_API_KEY` или `SERPAPI_KEY` для веб-поиска (Use Web Data).

### 3. Промпты (опционально)

```bash
cp src/main/prompts.private.example.ts src/main/prompts.private.ts
```

Без этого — стандартные промпты (Strategist, Skeptic, Practitioner, Explainer, Final Conclusion).

---

## Запуск

### Desktop (локально, без backend)

```bash
npm run dev:local
```

Ollama должен быть запущен. 4 агента без лимитов.

### Полный стек (backend + Google + Stripe)

```bash
npm run dev
```

Запускает backend (8787), renderer (5173), Electron.

### Web-режим (браузер/мобилка)

```bash
npm run dev:backend
npm run dev:renderer
```

Открой `http://localhost:5173`. Для ngrok — см. [WEB_MODE_SETUP.md](./WEB_MODE_SETUP.md).

### Server (VPS, Express)

```bash
npm run server
```

Слушает порт 3000. POST `/api/chat` — 4 агента + итог, streaming. Конфиг: `server/.env`:

```env
OLLAMA_HOST=http://127.0.0.1:11434
PORT=3000
```

---

## Деплой на VPS

1. `server/.env` — `OLLAMA_HOST`, `PORT`
2. PM2: `pm2 start ecosystem.config.js` или `pm2 start server/index.js --name thinknest`
3. Nginx: `nginx/thinknest.conf` — прокси 80 → 3000

---

## Документация

| Файл | Описание |
|------|----------|
| [README_FIRST.md](./README_FIRST.md) | Быстрый старт |
| [DEPLOY_UBUNTU.md](./DEPLOY_UBUNTU.md) | Деплой на Ubuntu — от клона до работающей ссылки |
| [WEB_MODE_SETUP.md](./WEB_MODE_SETUP.md) | Web-режим, ngrok |
| [STRIPE_SETUP.md](./STRIPE_SETUP.md) | Stripe, подписки |
| [PUBLISHING.md](./PUBLISHING.md) | Публикация репо |

---

## Устранение проблем

**Таймаут / "operation aborted":**  
Увеличь `OLLAMA_TIMEOUT_MS` в `backend/.env` или `src/main/.env`. Для CPU: 90000.

**Только 1 ответ из 4:**  
Проверь: `ollama list` — должны быть `llama3.2:3b` и `qwen2.5:3b`.

**Backend недоступен:**  
Запусти `npm run dev:backend` и `npm run dev:renderer`, открой браузер (не Electron).
