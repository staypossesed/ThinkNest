# Multi Agent Desktop (Free/Pro MVP)

> **Read this first:** [README_FIRST.md](./README_FIRST.md) — quick start in English and Russian.

Desktop-приложение на Electron + React с 4 AI-агентами и итоговым агрегатором.

> **Публикация репо:** см. [PUBLISHING.md](./PUBLISHING.md) — как сделать репо публичным без утечки секретов.
Поддерживает:
- Google login
- Free/Pro тарифы
- Stripe подписку (Checkout + Portal)
- лимиты запросов на backend (Supabase)

## Стек
- Desktop: Electron + React + TypeScript
- Backend: Fastify + TypeScript
- DB/Auth storage: Supabase
- Billing: Stripe
- LLM runtime: Ollama (на сервере — пользователям не нужно устанавливать)

## 1) Локальная разработка

### Требования
- Node.js LTS
- Ollama
- Аккаунты: Supabase, Stripe, Google Cloud OAuth

### Установка
```bash
npm install
npm --prefix backend install
```

### Установка моделей Ollama (по одной)
```bash
ollama pull phi3
ollama pull mistral
ollama pull llama3.1
ollama pull llava   # для распознавания картинок (OCR, объекты)
```
> `ollama pull` принимает только одну модель за раз.

### Переменные окружения
1. Скопируй `backend/.env.example` -> `backend/.env` и заполни все ключи.
2. Скопируй `.env.example` -> `.env` в корне (desktop env).
3. **Промпты (опционально):** скопируй `src/main/prompts.private.example.ts` -> `src/main/prompts.private.ts` и заполни своими промптами. Без этого — минимальные defaults. Файл в .gitignore.
4. **Web Search (Use Web Data):** добавь в корневой `.env` один из ключей:
   - `SERPER_API_KEY` — бесплатно 2500 запросов/мес: https://serper.dev
   - `SERPAPI_KEY` — альтернатива: https://serpapi.com
   Без ключа поиск использует только Wikipedia и DuckDuckGo (менее надёжно).

### Запуск

**Режим разработки (без backend и Google):**
```bash
npm run dev:local
```
Запускает только desktop с 4 агентами и без лимитов. Идеально для тестирования и доработки. Ollama должен быть запущен.

**Полный стек (с backend, Google, Stripe, модели на сервере):**
```bash
npm run dev
```
Команда запускает одновременно:
- backend (`http://localhost:8787`) — выполняет AI-агентов через Ollama на сервере
- renderer (`http://localhost:5173`)
- electron main process

**Требование:** Ollama должен быть запущен на машине с backend (или укажи `OLLAMA_BASE_URL` в `backend/.env` на удалённый сервер). Модели: `ollama pull phi3 mistral llama3.1 llava`

**Web-режим (браузер, мобилка):**
```bash
npm run dev:backend
npm run dev:renderer
```
Открой `http://localhost:5173` в браузере. Для доступа с телефона используй ngrok: `ngrok http 5173`, добавь ngrok URL в `backend/.env` (APP_ORIGINS, GOOGLE_REDIRECT_URI) и в Google OAuth.

## 2) Настройка Supabase

1. Создай проект в Supabase.
2. Выполни SQL из:
   - `backend/supabase/migrations/001_init.sql`
3. В `backend/.env` добавь:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 3) Настройка Google OAuth

1. В Google Cloud Console создай OAuth Client.
2. Redirect URI:
   - `http://localhost:8787/auth/google/callback` (dev)
   - `https://<your-backend-domain>/auth/google/callback` (prod)
3. В `backend/.env` добавь:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`

## 4) Настройка Stripe

**Подробная пошаговая инструкция:** см. [STRIPE_SETUP.md](./STRIPE_SETUP.md).

Кратко:
1. **Products:** В Product catalog создай 3 продукта (Pro Weekly, Pro Monthly, Pro Yearly) или используй уже созданные. Скопируй **Price ID** (price_...) для каждого.
2. **API keys:** Developers → API keys → Secret key и Webhook signing secret.
3. **Webhook:** `POST https://<your-backend>/webhooks/stripe` — события: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`.
4. **Customer Portal:** Settings → Billing → Customer portal — включи.
5. **backend/.env:** заполни `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_WEEKLY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`. Опционально: `STRIPE_COUPON_1PLUS1` для скидки на год.

## 5) Деплой backend на Railway

1. Создай проект на Railway и подключи репозиторий.
2. Root directory: `backend`.
3. Build command:
   - `npm install && npm run build`
4. Start command:
   - `npm run start`
5. Добавь все переменные из `backend/.env`.
6. После деплоя проверь:
   - `GET https://<domain>/health`

## 6) Конфигурация desktop под production

1. Перед сборкой задай production backend URL:
```powershell
$env:BACKEND_API_URL="https://<your-backend-domain>"
```
2. Сборка Windows:
```bash
npm run package
```
3. Установщик появится в `dist/app`.

## 7) Free/Pro логика (MVP)

- Free:
  - 2 агента
  - 20 запросов в день
- Pro:
  - 4 агента
  - 500 запросов в месяц

Лимиты применяются на backend через `entitlements` + `usage`.

## 8) Юридический дисклеймер

В UI встроен дисклеймер:
- ответы по юридическим вопросам носят информационный характер
- не заменяют консультацию юриста

## 9) Устранение проблем (Ollama)

**"This operation was aborted" / таймаут:**
- Таймаут 120 сек. Если Критик (mistral) всё равно падает — попробуй `ollama pull mistral:7b` и в `config.ts` замени `critic: "mistral"` на `critic: "mistral:7b"`.
- По умолчанию агенты запускаются **последовательно** (надёжнее). Для параллельного — `SEQUENTIAL_AGENTS=false`.

**Только 1 ответ из 4:**
- Убедись, что все 4 модели скачаны: `ollama pull llama3.1 mistral qwen2.5 phi3`. Ollama должен быть запущен и доступен.

**Итог без ссылок на модели:**
- Агрегатор теперь добавляет блок **Источники:** с перечислением агентов, давших вклад.

**Web mode: "Backend недоступен":**
- Запусти `npm run dev:backend` и `npm run dev:renderer`, открой `http://localhost:5173` в браузере (не Electron).
- Для ngrok: создай Web OAuth client в Google Console, добавь ngrok URL в APP_ORIGINS и GOOGLE_REDIRECT_URI.

## 10) QA чеклист (e2e)

- [ ] Google login проходит успешно и сессия сохраняется.
- [ ] `GET /entitlements` возвращает Free после регистрации.
- [ ] Free: после 20 запросов `canAsk` блокирует запрос.
- [ ] Stripe checkout переводит пользователя в Pro.
- [ ] После webhook в БД появляется активная подписка.
- [ ] Pro: доступно 4 агента и увеличенный лимит.
- [ ] Portal открывается и подписка управляется.
- [ ] Отмена подписки возвращает entitlement на Free.
