# QA Checklist (MVP)

## Автоматические проверки

- [x] `npm run build` (корень) проходит.
- [x] `npm --prefix backend run check` проходит.
- [x] Renderer/main/backend TypeScript компилируется без ошибок.

## Ручные e2e проверки (с настроенным Supabase/Google/Stripe)

- [ ] Google login: старт, callback, poll, восстановление сессии после перезапуска приложения.
- [ ] Free entitlement: 2 агента активны, лимит 20/день соблюдается.
- [ ] Счётчик использования увеличивается после каждого успешного вопроса.
- [ ] Upgrade flow: Stripe Checkout открывается из приложения и завершается.
- [ ] Webhook sync: подписка становится `active`, план переключается на `pro`.
- [ ] Pro entitlement: 4 агента активны, лимит 500/месяц.
- [ ] Billing portal открывается, отмена подписки возвращает на Free.
- [ ] UX: ошибки отображаются при сбоях auth/billing/network.
- [ ] Юридический дисклеймер виден в форме вопроса и понятен.
