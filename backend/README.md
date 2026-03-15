# Backend (Stripe + Auth + Entitlements)

## Локальный запуск

1. Скопируй `.env.example` в `.env` и заполни значения.
2. Примени SQL-миграцию в Supabase SQL editor:
   - `supabase/migrations/001_init.sql`
3. Установи и запусти:
   - `npm install`
   - `npm run dev`

## Endpoints

- `GET /health`
- `GET /portal` (веб-логин + billing одностраничник)
- `GET /auth/google/start`
- `GET /auth/google/poll?state=...`
- `GET /auth/google/callback`
- `GET /me`
- `GET /entitlements`
- `POST /usage/can-ask`
- `POST /usage/consume`
- `POST /billing/checkout`
- `POST /billing/portal`
- `POST /webhooks/stripe`
