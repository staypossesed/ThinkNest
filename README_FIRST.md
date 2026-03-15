# Read This First / Прочитайте сначала / 请先阅读

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

For mobile access: use `ngrok http 5173` and add the ngrok URL to `backend/.env` and Google OAuth. See [WEB_MODE_SETUP.md](./WEB_MODE_SETUP.md).

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

Для доступа с телефона: используй `ngrok http 5173` и добавь ngrok URL в `backend/.env` и Google OAuth. См. [WEB_MODE_SETUP.md](./WEB_MODE_SETUP.md).

### Production-деплой

См. [README.md](./README.md) и [DEPLOY_UBUNTU.md](./DEPLOY_UBUNTU.md) — вход через Google, подписки Stripe, настройка сервера.

---

## 中文

### ThinkNest 是什么？

ThinkNest 是一款桌面应用，配备 4 个 AI 代理（规划师、批评家、实践者、解释者），可回答您的问题。本地运行，使用 Ollama，支持 Google 登录、网页模式（浏览器/手机）和 Pro 订阅。

### 快速开始（5 分钟）

1. **安装：**

   ```bash
   npm install
   npm --prefix backend install
   ```

2. **复制环境文件：**
   - `backend/.env.example` → `backend/.env`
   - `.env.example` → `.env`

3. **拉取 Ollama 模型**（一次一个）：

   ```bash
   ollama pull llama3.1:8b
   ollama pull qwen2.5:7b
   ```

   图片识别可选：`ollama pull llava`

4. **运行：**

   ```bash
   npm run dev
   ```

   将打开 Electron 应用。Ollama 必须已运行。

### 网页模式（浏览器 / 手机）

运行 backend 和 frontend，在浏览器中打开：

```bash
npm run dev:backend
npm run dev:renderer
```

在 Chrome 或 Edge 中打开 **http://localhost:5173**（不要用 Electron）。使用 Google 登录以提问。

手机访问：使用 `ngrok http 5173`，将 ngrok URL 添加到 `backend/.env` 和 Google OAuth。参见 [WEB_MODE_SETUP.md](./WEB_MODE_SETUP.md)。

### 生产部署

参见 [README.md](./README.md) 和 [DEPLOY_UBUNTU.md](./DEPLOY_UBUNTU.md) — Google 登录、Stripe 订阅、服务器配置。
