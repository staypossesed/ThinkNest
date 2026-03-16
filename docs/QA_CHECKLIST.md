# QA Checklist (MVP)

## Automated checks

- [x] `npm run build` (root) passes.
- [x] `npm --prefix backend run check` passes.
- [x] Renderer/main/backend TypeScript compile passes.

## Manual e2e checks (run with configured Supabase/Google/Stripe)

- [ ] Google login: start, callback, poll, session restore after app restart.
- [ ] Free entitlement: 2 agents active, 20/day limit enforced.
- [ ] Usage counter increments after each successful question.
- [ ] Upgrade flow: Stripe Checkout opens from app and completes.
- [ ] Webhook sync: subscription becomes `active`, plan switches to `pro`.
- [ ] Pro entitlement: 4 agents active, 500/month limit.
- [ ] Billing portal opens and cancellation propagates back to Free.
- [ ] UX: errors displayed for auth/billing/network failures.
- [ ] Legal disclaimer visible in question form and understood.
