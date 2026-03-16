# Stripe setup: connect your 3 products to the project

---

## Server-side AI (models on server)

The app now supports **server-side models**: users don't need to install Ollama. The backend runs the AI agents. Configure:

1. **Deploy Ollama** on a server (same machine as backend, or a separate VM).
2. Install models: `ollama pull llama3.1:8b && ollama pull qwen2.5:7b` (optional: `ollama pull llava` for images)
3. In `backend/.env` set: `OLLAMA_BASE_URL=http://your-ollama-server:11434/v1`
4. When running `npm run dev` (not `dev:local`), the desktop app uses the backend for ask — no local Ollama needed.

---

# Stripe setup

Your app already has Stripe integration (Checkout + Customer Portal + webhooks). Follow these steps to connect the products you created (Pro Weekly, Pro Monthly, Pro Yearly).

---

## 1. Get API keys

1. Open [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **API keys**.
2. Copy:
   - **Secret key** (starts with `sk_test_` in sandbox) → `STRIPE_SECRET_KEY`
   - Keep **Publishable key** for future use if you add a web checkout page.

---

## 2. Get Price IDs for your 3 products

The backend needs **Price IDs** (not Product IDs). Each product has at least one Price.

1. Go to **Product catalog** → **All products**.
2. For each product, click the product name:
   - **Pro Weekly** → open product → under **Pricing**, find the price (e.g. $4.99 USD / week) → copy the **Price ID** (starts with `price_`) → use for `STRIPE_PRICE_WEEKLY`.
   - **Pro Monthly** → same → copy Price ID → `STRIPE_PRICE_MONTHLY`.
   - **Pro Yearly** → same → copy Price ID → `STRIPE_PRICE_YEARLY`.

If you have only one price per product, that ID is what you need.

---

## 3. Create a webhook

1. **Developers** → **Webhooks** → **Add endpoint**.
2. **Endpoint URL:**  
   - Local (with tunnel): `https://<your-ngrok-or-similar>/webhooks/stripe`  
   - Production: `https://<your-backend-domain>/webhooks/stripe`
3. **Events to send:** select:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed` (optional, for logging)
4. Create → copy **Signing secret** (starts with `whsec_`) → `STRIPE_WEBHOOK_SECRET`.

**Local testing:** Stripe cannot reach `localhost`. Use [ngrok](https://ngrok.com) or [Stripe CLI](https://stripe.com/docs/stripe-cli) (`stripe listen --forward-to localhost:8787/webhooks/stripe`) only when testing on your machine. **Production:** No ngrok — deploy backend to a server (VPS, cloud), set webhook URL to `https://your-api-domain/webhooks/stripe`.

---

## 4. Enable Customer Portal

1. **Settings** (gear) → **Billing** → **Customer portal**.
2. Turn on the portal so users can manage subscription (cancel, update payment).
3. Set **Return URL** to your app (e.g. `http://localhost:5173` for dev).

---

## 5. Optional: yearly coupon (e.g. 30% off)

You created a coupon like **"30 % Year Subscription Discount"** (30% off once).

1. **Product catalog** → **Coupons** → open your coupon.
2. Copy the **Coupon ID** (starts with a string like the coupon name; the API ID may look like `ABC123` or similar — use the ID from API/Coupon details).
3. In `backend/.env` set:
   - `STRIPE_COUPON_1PLUS1=<your-coupon-id>`
   - The backend applies this automatically when the user selects the **yearly** plan at checkout.

If you use **Promotion codes** instead of direct coupon ID, the app can still send `promo_code` in the checkout request body; the backend supports `body.promo_code` for that.

---

## 6. Configure backend `.env`

1. Copy `backend/.env.example` to `backend/.env` (if you haven’t).
2. Fill Stripe variables:

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

- **Production:** set `STRIPE_SUCCESS_URL` and `STRIPE_CANCEL_URL` to your real app URL (e.g. your desktop app’s deep link or landing page).

---

## 7. Run and test

1. Start backend: from project root, `npm run dev` (or run backend alone on port 8787).
2. Start desktop: `npm run dev` (or use the built app with `BACKEND_API_URL` pointing to your backend).
3. In the app: sign in with Google → open **Upgrade / Billing** → choose a plan (e.g. Pro Monthly) → you should be redirected to Stripe Checkout.
4. Use Stripe test card `4242 4242 4242 4242` to complete payment.
5. After payment, webhook should run and the user’s subscription should appear in the app (Pro, 4 agents, etc.).
6. **Billing** / “Manage subscription” should open Stripe Customer Portal.

---

## Summary: what the project already does

| Feature | Where it’s implemented |
|--------|-------------------------|
| Checkout (weekly/monthly/yearly) | `backend/src/billing/routes.ts` → `POST /billing/checkout` |
| Customer Portal link | `backend/src/billing/routes.ts` → `POST /billing/portal` |
| Subscription status | `GET /billing/subscription`, entitlements |
| Webhook (subscription created/updated/deleted) | `backend/src/webhooks/routes.ts` → `POST /webhooks/stripe` |
| Desktop opening Checkout/Portal | `src/main/backend.ts` → `createCheckoutUrl` / `createPortalUrl`; UI in `App.tsx` and `UpgradeModal` |

You only need to add the correct keys and Price IDs to `backend/.env` and configure the webhook + portal as above.
