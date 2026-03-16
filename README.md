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
ollama pull llama3.1:8b
ollama pull qwen2.5:7b
```

**Опционально (картинки):**
```bash
ollama pull llava   # распознавание картинок
```

> `ollama pull` принимает только одну модель за раз.

**Освободить место:** `ollama list` → `ollama rm <имя>` для ненужных моделей.

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

### Локальный режим (без backend)

```bash
npm run dev:local
```

- **Без backend** — только Electron + Vite + main
- **Без входа** — Google OAuth не нужен, `DEV_MODE=true`
- **Ollama** должен быть запущен
- 4 агента без лимитов

### Полный режим (backend + Google + Stripe)

```bash
npm run dev
```

- **С backend** — backend (8787), renderer (5173), Electron
- **Вход через Google** — нужен `backend/.env` с `GOOGLE_*`, `APP_ORIGIN`, `GOOGLE_REDIRECT_URI`
- Для localhost: `GOOGLE_REDIRECT_URI=http://localhost:8787/auth/google/callback` (callback на backend)
- **Google Console** — добавь в Authorized redirect URIs: `http://localhost:8787/auth/google/callback`
- Отладка: открой `http://localhost:8787/auth/google/redirect-uri` — там URL, который должен быть в Google Console

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

## Тесты

```bash
npm run test           # Vitest: промпты, конфиг, webBackendClient (retries, health)
npm run test:watch     # Vitest в watch-режиме
npm run test:billing   # Проверка Stripe и /health
npm run test:ask-api   # Интеграция: /health, /ask (нужен backend)
```

Веб и десктоп используют одинаковые промпты (TRUTHFUL_FAST) и модели — ответы не должны отличаться.

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

### 2026-02-27 (Pro, обновление после оплаты)

**Pro-план и подписка:**
- **Pro: 70 запросов в день** (было 500/месяц) — `PRO_ENTITLEMENTS`, миграция `004_pro_70_daily.sql`
- **Автообновление после оплаты** — при возврате на вкладку приложения (после Stripe) entitlements и подписка обновляются без перезагрузки (`visibilitychange`)
- **Сообщение при лимите** — фиолетовый цвет, текст «Обновите план до Pro» (`entitlements/routes.ts`, `MessageInput.tsx`)
- **UpgradeModal** — длительность планов (7/30/365 дней), подсказка тестовой карты Stripe (4242…)

---

### 2026-03-13–15 (Deep Research, i18n, UI)

**Deep Research:**
- **Обычный режим** — 1 ответ (maxAgents=1)
- **Deep Research** — 2 перспективы (free) или 4 (pro)
- Бейдж «2 PERSPECTIVES» / «4 PERSPECTIVES» только при включённом Deep Research
- `preferredLocale` из языка вопроса для ответов

**Локализация (ru/en/zh):**
- «Ответы на» → «Язык» в LanguageSelector
- ExportPanel, ShareButton — все подписи через `t()`
- FinalAnswer: `finalConclusion1/2`, `synthesizedFrom2/4`, `perspectivesHeaderN`

**UI:**
- Убраны кнопки Refresh и Settings из сайдбара
- Модели: llama3.1:8b, qwen2.5:7b (llava — опционально для картинок)

**Тесты:**
- Vitest: prompts, askConfig, webBackendClient, orchestrator
- `npm run test:ask-api` — интеграция /health, /ask

---

### 2026-03-15 (billing)

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

### 2026-02-27 (web parity)

**Веб = десктоп по качеству ответов:**
- Backend промпты заменены на TRUTHFUL_FAST_PROMPT (как в prompts.private)
- SYSTEM_PREFIX: «ЗАПРЕЩЕНО отказываться, говорить „вопрос расплывчатый“»
- Retries в webAsk: 3 попытки при 5xx, network errors
- Таймаут backend: 60000 (как в main)
- Vitest: 19 тестов (prompts, askConfig, webBackendClient, orchestrator)

**Orchestrator:**
- `getLanguageInstruction`, `getFocusInstruction`, judge language, user content suffixes
- Fallbacks для language/instruction

**Auth:**
- Google redirect_uri, загрузка конфига из папки backend
- `/health` возвращает `redirect_uri` для отладки

---

### 2026-02-27 (web mode)

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
Проверь: `ollama list` — должны быть `llama3.1:8b` и `qwen2.5:7b`.

**Backend недоступен:**  
Запусти `npm run dev:backend` и `npm run dev:renderer`, открой браузер (не Electron).

**ERR_NGROK_3200 / redirect_uri_mismatch:**  
1. Останови backend (Ctrl+C), перезапусти `npm run dev`.  
2. Открой `http://localhost:8787/health` — скопируй `redirect_uri` оттуда.  
3. В Google Console → Credentials → OAuth 2.0 Client (с твоим GOOGLE_CLIENT_ID) → Authorized redirect URIs — добавь **точно такой же** URL (копируй из /health).  
4. Сохрани, подожди 5–10 мин. Добавь оба варианта на всякий случай: `http://localhost:8787/auth/google/callback` и `http://127.0.0.1:8787/auth/google/callback`.
