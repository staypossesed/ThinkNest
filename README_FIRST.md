# Read This First / Прочитайте сначала

---

## English

### What is ThinkNest?

ThinkNest is a desktop app with 4 AI agents (Planner, Critic, Pragmatist, Explainer) that answer your questions. It runs locally with Ollama and supports Google login, web mode (browser/mobile), and Pro subscriptions.

### Quick Start (5 minutes)

1. **Install:**
   ```bash
   npm install
   npm --prefix backend install
   ```

2. **Copy env files:**
   - `backend/.env.example` → `backend/.env`
   - `.env.example` → `.env`

3. **Pull Ollama models** (one at a time):
   ```bash
ollama pull llama3.1:8b
ollama pull qwen2.5:7b
   ```
   Optional for images: `ollama pull llava`

4. **Run:**
   ```bash
   npm run dev
   ```
   Opens the Electron app. Ollama must be running.

### Web Mode (browser / mobile)

Run backend + frontend, open in browser:

```bash
npm run dev:backend
npm run dev:renderer
```

Open **http://localhost:5173** in Chrome or Edge (not Electron). Sign in with Google to ask questions.

For mobile access: use `ngrok http 5173` and add the ngrok URL to `backend/.env` and Google OAuth. See [docs/WEB_MODE_SETUP.md](./docs/WEB_MODE_SETUP.md).

### Production Deployment

See [README.md](./README.md) and [DEPLOY_UBUNTU.md](./DEPLOY_UBUNTU.md) for full deployment: Google login, Stripe subscriptions, server setup.

---

## Русский

### Что такое ThinkNest?

ThinkNest — десктопное приложение с 4 AI-агентами (Планировщик, Критик, Практик, Объяснитель), которые отвечают на ваши вопросы. Работает локально с Ollama, поддерживает вход через Google, веб-режим (браузер/мобилка) и Pro-подписки.

### Быстрый старт (5 минут)

1. **Установка:**
   ```bash
   npm install
   npm --prefix backend install
   ```

2. **Скопируй env-файлы:**
   - `backend/.env.example` → `backend/.env`
   - `.env.example` → `.env`

3. **Скачай модели Ollama** (по одной):
   ```bash
ollama pull llama3.1:8b
ollama pull qwen2.5:7b
   ```
   Опционально для картинок: `ollama pull llava`

4. **Запуск:**
   ```bash
   npm run dev
   ```
   Откроется Electron-приложение. Ollama должен быть запущен.

### Веб-режим (браузер / мобилка)

Запусти backend и frontend, открой в браузере:

```bash
npm run dev:backend
npm run dev:renderer
```

Открой **http://localhost:5173** в Chrome или Edge (не Electron). Войди через Google, чтобы задавать вопросы.

Для доступа с телефона: используй `ngrok http 5173` и добавь ngrok URL в `backend/.env` и Google OAuth. См. [docs/WEB_MODE_SETUP.md](./docs/WEB_MODE_SETUP.md).

### Production-деплой

См. [README.md](./README.md) и [DEPLOY_UBUNTU.md](./DEPLOY_UBUNTU.md) — вход через Google, подписки Stripe, настройка сервера.
