# Проверка оплаты Stripe

## Автоматический тест

1. Запусти backend: `npm run dev:backend`
2. В другом терминале: `node scripts/test-billing.mjs`
3. Ожидаемый вывод: `✓ GET /billing/status`, `✓ GET /health`

## Ручная проверка

### 1. Кнопка «Моя подписка» (Pro)

- Войди через Google
- Оформи подписку (Pro) через Stripe Checkout
- В сайдбаре должна появиться кнопка **«Моя подписка»**
- Под кнопкой — «X дней до конца» и дата окончания
- Нажатие открывает Stripe Customer Portal (управление подпиской)

### 2. Кнопка «Pro» (Free)

- Войди через Google (без подписки)
- В сайдбаре — кнопка **«Pro»**
- Нажатие открывает модал с 3 планами: Неделя, Месяц, Год
- У плана «Год» — бейдж «Год+год бесплатно» (купон)

### 3. Выбор плана и оплата

- Выбери план (например, Месяц)
- Откроется Stripe Checkout в новой вкладке
- Тестовая карта: `4242 4242 4242 4242`
- После оплаты — webhook обновит подписку, план станет Pro

### 4. Переводы (ru / en / zh)

- **Моя подписка** — ru / My subscription / 我的订阅
- **X дней до конца** — ru / days left / 天剩余
- **Подписка до** — ru / Subscription until / 订阅至
- **Управление подпиской** — ru / Manage subscription / 管理订阅

## Частые ошибки

| Проблема | Решение |
|----------|---------|
| «Billing is not configured» | Заполни `backend/.env`: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_*, STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL |
| Кнопка не открывает Stripe | Проверь консоль (F12), смотри ошибки сети |
| Webhook не срабатывает | Для localhost используй ngrok, добавь URL в Stripe Dashboard → Webhooks |
