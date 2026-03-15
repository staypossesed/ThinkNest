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
| [docs/BILLING_VERIFY.md](./docs/BILLING_VERIFY.md) | Проверка оплаты (тесты, инструкции) |
| [PUBLISHING.md](./PUBLISHING.md) | Публикация репо |

---

## История исправлений (Changelog)

### 2026-03-15

**Добавлено:**
- **Кнопка «Моя подписка»** — для Pro-пользователей, открывает Stripe Customer Portal (управление подпиской)
- **Счётчик дней** — под кнопкой отображается «X дней до конца» и дата окончания подписки
- **Переводы** — `mySubscription`, `daysLeft`, `subscriptionEndsIn`, `manageSubscription` (ru/en/zh)
- **Бейдж «Год+год бесплатно»** — в модале выбора плана для тарифа «Год» (купон)
- **GET /billing/status** — эндпоинт проверки конфигурации Stripe (configured, hasPrices, hasSuccessUrl, hasCancelUrl)
- **`npm run test:billing`** — скрипт проверки billing/status и health
- **docs/BILLING_VERIFY.md** — инструкция по проверке оплаты

**Изменено:**
- **ChatSidebar** — кнопка «Моя подписка» вместо «Billing» для Pro, под ней дни до конца
- **webOpenCheckout / webOpenPortal** — выброс ошибки, если Stripe вернул `url: null`
- **UpgradeModal** — бейдж купона для yearly, обновлён layout планов

---

### 2026-02-27

**Что работало некорректно:**
- В веб-режиме отображался бейдж «Dev» — приложение выглядело как режим разработчика
- При вопросах без входа показывалось «Войдите через Google» вместо реальных ответов (ожидаемо), но сообщения содержали подсказки для разработчиков («npm run dev:backend», «localhost:5173»)
- `getSubscription` и `openCheckout`/`openPortal` в веб-режиме не вызывали backend — всегда возвращались заглушки
- Не было отладочных логов для диагностики проблем на production

**Что подправили:**
- `isDevMode()` в веб-режиме возвращает `false` — бейдж «Dev» скрыт
- Сообщения для production (не localhost) заменены на нейтральные: «Сервис временно недоступен», «Попробуйте позже»
- Подключены реальные вызовы backend: `webGetSubscription`, `webOpenCheckout`, `webOpenPortal`
- Добавлен debug-режим: `?debug=1` в URL или `localStorage.thinknest_debug=1` — логи в консоли (checkBackend, session, ask, 401)
- Bootstrap в веб-режиме загружает entitlements даже без сессии (для UI)
- В DEPLOY_UBUNTU.md — раздел про Google OAuth и отладку

---

## Устранение проблем

**Таймаут / "operation aborted":**  
Увеличь `OLLAMA_TIMEOUT_MS` в `backend/.env` или `src/main/.env`. Для CPU: 90000.

**Только 1 ответ из 4:**  
Проверь: `ollama list` — должны быть `llama3.2:3b` и `qwen2.5:3b`.

**Backend недоступен:**  
Запусти `npm run dev:backend` и `npm run dev:renderer`, открой браузер (не Electron).
