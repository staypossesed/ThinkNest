# Настройка Stripe: подключение 3 продуктов к проекту

---

## Серверный AI (модели на сервере)

Приложение поддерживает **серверные модели**: пользователям не нужно устанавливать Ollama. Бэкенд запускает AI-агентов. Настройка:

1. **Разверни Ollama** на сервере (та же машина, что и бэкенд, или отдельная VM).
2. Установи модели: `ollama pull llama3.1:8b && ollama pull qwen2.5:7b` (опционально: `ollama pull llava` для изображений)
3. В `backend/.env` укажи: `OLLAMA_BASE_URL=http://your-ollama-server:11434/v1`
4. При запуске `npm run dev` (не `dev:local`) десктопное приложение использует бэкенд для ask — локальный Ollama не нужен.

---

# Настройка Stripe

В приложении уже есть интеграция Stripe (Checkout + Customer Portal + webhooks). Следуй шагам, чтобы подключить созданные продукты (Pro Weekly, Pro Monthly, Pro Yearly).

---

## 1. Получить API-ключи

1. Открой [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **API keys**.
2. Скопируй:
   - **Secret key** (начинается с `sk_test_` в sandbox) → `STRIPE_SECRET_KEY`
   - **Publishable key** сохрани для будущего, если добавишь веб-страницу оформления заказа.

---

## 2. Получить Price ID для 3 продуктов

Бэкенду нужны **Price IDs** (не Product IDs). У каждого продукта есть минимум один Price.

1. Перейди в **Product catalog** → **All products**.
2. Для каждого продукта нажми на название:
   - **Pro Weekly** → открой продукт → в **Pricing** найди цену (например $4.99 USD / week) → скопируй **Price ID** (начинается с `price_`) → используй для `STRIPE_PRICE_WEEKLY`.
   - **Pro Monthly** → то же → скопируй Price ID → `STRIPE_PRICE_MONTHLY`.
   - **Pro Yearly** → то же → скопируй Price ID → `STRIPE_PRICE_YEARLY`.

Если у продукта только одна цена, этот ID и нужен.

---

## 3. Создать webhook

1. **Developers** → **Webhooks** → **Add endpoint**.
2. **Endpoint URL:**
   - Локально (с туннелем): `https://<your-ngrok-or-similar>/webhooks/stripe`
   - Продакшен: `https://<your-backend-domain>/webhooks/stripe`
3. **Events to send:** выбери:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed` (опционально, для логирования)
4. Create → скопируй **Signing secret** (начинается с `whsec_`) → `STRIPE_WEBHOOK_SECRET`.

**Локальное тестирование:** Stripe не может достучаться до `localhost`. Используй [ngrok](https://ngrok.com) или [Stripe CLI](https://stripe.com/docs/stripe-cli) (`stripe listen --forward-to localhost:8787/webhooks/stripe`) только при тестах на своей машине. **Продакшен:** без ngrok — разверни бэкенд на сервере (VPS, облако), укажи webhook URL как `https://your-api-domain/webhooks/stripe`.

---

## 4. Включить Customer Portal

1. **Settings** (шестерёнка) → **Billing** → **Customer portal**.
2. Включи портал, чтобы пользователи могли управлять подпиской (отмена, обновление платежа).
3. Укажи **Return URL** на приложение (например `http://localhost:5173` для dev).

---

## 5. Опционально: купон на год (например 30% скидка)

Ты создал купон типа **"30 % Year Subscription Discount"** (30% скидка один раз).

1. **Product catalog** → **Coupons** → открой купон.
2. Скопируй **Coupon ID** (строка вроде имени купона; API ID может выглядеть как `ABC123` — используй ID из API/Coupon details).
3. В `backend/.env` укажи:
   - `STRIPE_COUPON_1PLUS1=<your-coupon-id>`
   - Бэкенд применяет его автоматически, когда пользователь выбирает **годовой** план при оформлении.

Если используешь **Promotion codes** вместо прямого Coupon ID, приложение может передавать `promo_code` в теле запроса checkout; бэкенд поддерживает `body.promo_code`.

---

## 6. Настроить backend `.env`

1. Скопируй `backend/.env.example` в `backend/.env` (если ещё не сделал).
2. Заполни переменные Stripe:

```env
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx
STRIPE_PRICE_WEEKLY=price_xxxxxxxxxxxx
STRIPE_PRICE_MONTHLY=price_xxxxxxxxxxxx
STRIPE_PRICE_YEARLY=price_xxxxxxxxxxxx
STRIPE_COUPON_1PLUS1=your_coupon_id_optional
STRIPE_SUCCESS_URL=http://localhost:5173
STRIPE_CANCEL_URL=http://localhost:5173
```

- **Продакшен:** укажи `STRIPE_SUCCESS_URL` и `STRIPE_CANCEL_URL` на реальный URL приложения (например deep link десктопного приложения или лендинг).

---

## 7. Запуск и тест

1. Запусти бэкенд: из корня проекта `npm run dev` (или только бэкенд на порту 8787).
2. Запусти десктоп: `npm run dev` (или собранное приложение с `BACKEND_API_URL` на твой бэкенд).
3. В приложении: войди через Google → открой **Upgrade / Billing** → выбери план (например Pro Monthly) → должен открыться Stripe Checkout.
4. Используй тестовую карту Stripe `4242 4242 4242 4242` для оплаты.
5. После оплаты webhook должен отработать, подписка пользователя появится в приложении (Pro, 4 агента и т.д.).
6. **Billing** / «Manage subscription» должен открывать Stripe Customer Portal.

---

## Итог: что уже реализовано в проекте

| Функция | Где реализовано |
|--------|------------------|
| Checkout (weekly/monthly/yearly) | `backend/src/billing/routes.ts` → `POST /billing/checkout` |
| Ссылка на Customer Portal | `backend/src/billing/routes.ts` → `POST /billing/portal` |
| Статус подписки | `GET /billing/subscription`, entitlements |
| Webhook (подписка создана/обновлена/удалена) | `backend/src/webhooks/routes.ts` → `POST /webhooks/stripe` |
| Десктоп открывает Checkout/Portal | `src/main/backend.ts` → `createCheckoutUrl` / `createPortalUrl`; UI в `App.tsx` и `UpgradeModal` |

Нужно только добавить правильные ключи и Price IDs в `backend/.env` и настроить webhook + portal как выше.
