# Backend (Stripe + Auth + Entitlements)

## Run locally

1. Copy `.env.example` to `.env` and fill values.
2. Apply SQL migration in Supabase SQL editor:
   - `supabase/migrations/001_init.sql`
3. Install and run:
   - `npm install`
   - `npm run dev`

## Endpoints

- `GET /health`
- `GET /portal` (web login + billing one-page)
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
