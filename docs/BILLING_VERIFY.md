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

### 3. Выбор плана и оплата (тест без реальной оплаты)

- Выбери план: **Неделя** (7 дней), **Месяц** (30 дней) или **Год** (365 дней)
- Откроется Stripe Checkout в новой вкладке
- **Тест без оплаты:** используй тестовую карту `4242 4242 4242 4242` (любая дата в будущем, любой CVC)
- В Stripe Dashboard должен быть включён **Test mode** (ключи `sk_test_...`)
- После «оплаты» тестовой картой — webhook обновит подписку, план станет Pro

### 4. Переводы (ru / en / zh)

- **Моя подписка** — ru / My subscription / 我的订阅
- **X дней до конца** — ru / days left / 天剩余
- **Подписка до** — ru / Subscription until / 订阅至
- **Управление подпиской** — ru / Manage subscription / 管理订阅

## Миграции Supabase (обязательно)

Если webhook падает с `Could not find the 'cancel_at_period_end' column` — выполни миграции в Supabase Dashboard → SQL Editor:

```sql
-- 003: plan_interval, cancel_at_period_end
alter table subscriptions add column if not exists plan_interval text default 'monthly';
alter table subscriptions add column if not exists cancel_at_period_end boolean default false;

-- 004: Pro 70/day
update plans set max_questions = 70, period_type = 'daily' where code = 'pro';
```

---

## Частые ошибки

| Проблема | Решение |
|----------|---------|
| «Billing is not configured» | Заполни `backend/.env`: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_*, STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL |
| Кнопка не открывает Stripe | Проверь консоль (F12), смотри ошибки сети |
| **Pro не активируется после оплаты** | **Локально:** Stripe не достучится до localhost — нужен ngrok или Stripe CLI. **Продакшен:** backend на сервере (VPS) — webhook `https://ваш-api/webhooks/stripe`, ngrok не нужен. |
| **«Не вошёл» после оплаты** | Если оплатил из десктоп-приложения — Stripe открылся в браузере, после оплаты редирект на веб. Веб не знает сессию десктопа. Появится сообщение «Оплата прошла» — вернись в десктоп-приложение, план Pro активируется (visibilitychange). |
| Webhook не срабатывает | Для localhost **обязательно** ngrok. Stripe шлёт webhook на публичный URL. Добавь `https://<ngrok>/webhooks/stripe` в Stripe Dashboard → Webhooks. |
