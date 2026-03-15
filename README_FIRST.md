# Read This First / Прочитайте сначала / 请先阅读

---

## English

```bash
npm install && npm --prefix backend install
cp backend/.env.example backend/.env
ollama pull llama3.1:8b && ollama pull qwen2.5:7b
npm run dev
```

Web: `npm run dev:backend` + `npm run dev:renderer` → http://localhost:5173. Full guide: [Русский](#русский).

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

```bash
npm install && npm --prefix backend install
cp backend/.env.example backend/.env
ollama pull llama3.1:8b && ollama pull qwen2.5:7b
npm run dev
```

网页：`npm run dev:backend` + `npm run dev:renderer` → http://localhost:5173。完整指南：[Русский](#русский)。
