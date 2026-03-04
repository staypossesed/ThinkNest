import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { config, stripeEnabled } from "../config";
import { supabase } from "../db";

const stripe = stripeEnabled ? new Stripe(config.STRIPE_SECRET_KEY!) : null;

function mapStripeStatus(status: string): string {
  if (status === "active" || status === "trialing" || status === "past_due") {
    return status;
  }
  return "inactive";
}

export async function registerWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/webhooks/stripe",
    { config: { rawBody: true } },
    async (request, reply) => {
      const webhookSecret = config.STRIPE_WEBHOOK_SECRET;
      if (!stripeEnabled || !stripe || !webhookSecret) {
        return reply.code(503).send({ error: "Stripe is not configured" });
      }
      const signature = request.headers["stripe-signature"];
      if (!signature || typeof signature !== "string") {
        return reply.code(400).send({ error: "Missing stripe-signature" });
      }

      const body = request.rawBody;
      if (!body) {
        return reply.code(400).send({ error: "Missing raw body" });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          body.toString(),
          signature,
          webhookSecret
        );
      } catch (error) {
        return reply.code(400).send({
          error: error instanceof Error ? error.message : "Webhook signature failed"
        });
      }

      try {
        if (
          event.type === "checkout.session.completed" ||
          event.type === "customer.subscription.updated" ||
          event.type === "customer.subscription.created" ||
          event.type === "customer.subscription.deleted"
        ) {
          const subscription =
            event.type === "checkout.session.completed"
              ? await resolveSubscriptionFromCheckoutSession(event.data.object as Stripe.Checkout.Session)
              : (event.data.object as Stripe.Subscription);

          await upsertSubscriptionFromStripe(subscription);
        }
        if (event.type === "invoice.payment_failed") {
          app.log.warn({ eventId: event.id }, "Stripe invoice.payment_failed");
        }
      } catch (error) {
        app.log.error(error);
        return reply.code(500).send({ error: "Webhook processing failed" });
      }

      return { received: true };
    }
  );
}

async function resolveSubscriptionFromCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<Stripe.Subscription> {
  if (!session.subscription || typeof session.subscription !== "string") {
    throw new Error("Checkout session missing subscription id");
  }
  return stripe!.subscriptions.retrieve(session.subscription);
}

function getIntervalFromPrice(price: Stripe.Price | null): "weekly" | "monthly" | "yearly" {
  if (!price?.recurring?.interval) return "monthly";
  const interval = price.recurring.interval;
  if (interval === "week") return "weekly";
  if (interval === "year") return "yearly";
  return "monthly";
}

async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ id: string }>();

  if (userError || !user) {
    throw new Error(`User not found for customer: ${customerId}`);
  }

  const item = subscription.items.data[0];
  const periodEndUnix = item?.current_period_end ?? null;
  const price = item?.price;
  const planInterval = getIntervalFromPrice(price);

  const payload = {
    user_id: user.id,
    stripe_subscription_id: subscription.id,
    status: mapStripeStatus(subscription.status),
    plan_code: "pro",
    plan_interval: planInterval,
    current_period_end: periodEndUnix
      ? new Date(periodEndUnix * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false
  };

  const { error } = await supabase
    .from("subscriptions")
    .upsert(payload, { onConflict: "stripe_subscription_id" });

  if (error) {
    throw new Error(`Failed to upsert subscription: ${error.message}`);
  }
}
