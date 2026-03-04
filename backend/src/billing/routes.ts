import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { config, stripeEnabled, stripePriceIds } from "../config";
import { DbUser, supabase } from "../db";

const stripe = stripeEnabled ? new Stripe(config.STRIPE_SECRET_KEY!) : null;

export type BillingPlan = "weekly" | "monthly" | "yearly";

const PLAN_TO_PRICE: Record<BillingPlan, keyof typeof stripePriceIds> = {
  weekly: "weekly",
  monthly: "monthly",
  yearly: "yearly"
};

async function getUser(userId: string): Promise<DbUser> {
  const { data, error } = await supabase
    .from("users")
    .select("id,email,google_sub,full_name,avatar_url,stripe_customer_id")
    .eq("id", userId)
    .single<DbUser>();
  if (error || !data) {
    throw new Error(`Failed to load user: ${error?.message ?? "unknown"}`);
  }
  return data;
}

async function ensureStripeCustomer(user: DbUser): Promise<string> {
  if (!stripe) {
    throw new Error("Stripe is not configured yet.");
  }
  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: {
      userId: user.id
    }
  });

  const { error } = await supabase
    .from("users")
    .update({ stripe_customer_id: customer.id })
    .eq("id", user.id);

  if (error) {
    throw new Error(`Failed to store customer id: ${error.message}`);
  }
  return customer.id;
}

function getPriceIdForPlan(plan: BillingPlan): string {
  const key = PLAN_TO_PRICE[plan];
  const priceId = stripePriceIds[key];
  if (!priceId) {
    throw new Error(`Plan "${plan}" is not configured. Set STRIPE_PRICE_${key.toUpperCase()}.`);
  }
  return priceId;
}

export async function registerBillingRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/billing/checkout",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (!stripeEnabled || !stripe) {
        return reply.code(503).send({
          error: "Billing is not configured yet. Configure Stripe envs to enable Pro payments."
        });
      }
      const body = request.body as { plan?: BillingPlan; promo_code?: string } | undefined;
      const plan: BillingPlan = body?.plan ?? "monthly";
      const promoCode = body?.promo_code?.trim();

      if (!["weekly", "monthly", "yearly"].includes(plan)) {
        return reply.code(400).send({ error: "Invalid plan. Use weekly, monthly, or yearly." });
      }

      try {
        const user = await getUser(request.user!.id);
        const customerId = await ensureStripeCustomer(user);
        const priceId = getPriceIdForPlan(plan);

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
          mode: "subscription",
          customer: customerId,
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: config.STRIPE_SUCCESS_URL!,
          cancel_url: config.STRIPE_CANCEL_URL!,
          metadata: { userId: user.id, plan }
        };

        if (promoCode) {
          sessionParams.discounts = [{ promotion_code: promoCode }];
        } else if (plan === "yearly" && config.STRIPE_COUPON_1PLUS1) {
          sessionParams.discounts = [{ coupon: config.STRIPE_COUPON_1PLUS1 }];
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        return { url: session.url };
      } catch (err) {
        app.log.error(err);
        const msg = err instanceof Error ? err.message : "Stripe checkout failed";
        return reply.code(500).send({ error: msg });
      }
    }
  );

  app.post("/billing/portal", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!stripeEnabled || !stripe) {
      return reply.code(503).send({
        error: "Billing is not configured yet. Configure Stripe envs to enable billing portal."
      });
    }
    try {
      const user = await getUser(request.user!.id);
      const customerId = await ensureStripeCustomer(user);
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: config.STRIPE_CANCEL_URL!
      });
      return { url: portal.url };
    } catch (err) {
      app.log.error(err);
      const msg = err instanceof Error ? err.message : "Stripe portal failed";
      return reply.code(500).send({ error: msg });
    }
  });

  app.get(
    "/billing/subscription",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      if (!stripeEnabled || !stripe) {
        return reply.code(503).send({
          error: "Billing is not configured."
        });
      }
      try {
        const { data: sub, error } = await supabase
          .from("subscriptions")
          .select("status, plan_code, plan_interval, current_period_end, cancel_at_period_end")
          .eq("user_id", request.user!.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          throw new Error(`Failed to fetch subscription: ${error.message}`);
        }

        if (!sub || !["active", "trialing", "past_due"].includes(sub.status)) {
          return {
            active: false,
            plan: null,
            interval: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false
          };
        }

        return {
          active: true,
          plan: sub.plan_code,
          interval: sub.plan_interval ?? "monthly",
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end ?? false
        };
      } catch (err) {
        app.log.error(err);
        const msg = err instanceof Error ? err.message : "Failed to fetch subscription";
        return reply.code(500).send({ error: msg });
      }
    }
  );
}
