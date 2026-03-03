import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { config, stripeEnabled } from "../config";
import { DbUser, supabase } from "../db";

const stripe = stripeEnabled ? new Stripe(config.STRIPE_SECRET_KEY!) : null;

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

export async function registerBillingRoutes(app: FastifyInstance): Promise<void> {
  app.post("/billing/checkout", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!stripeEnabled || !stripe) {
      return reply.code(503).send({
        error: "Billing is not configured yet. Configure Stripe envs to enable Pro payments."
      });
    }
    try {
      const user = await getUser(request.user!.id);
      const customerId = await ensureStripeCustomer(user);
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [
          {
            price: config.STRIPE_PRICE_PRO_MONTHLY!,
            quantity: 1
          }
        ],
        success_url: config.STRIPE_SUCCESS_URL!,
        cancel_url: config.STRIPE_CANCEL_URL!,
        metadata: {
          userId: user.id
        }
      });

      return { url: session.url };
    } catch (err) {
      app.log.error(err);
      const msg =
        err instanceof Error ? err.message : "Stripe checkout failed";
      return reply.code(500).send({ error: msg });
    }
  });

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
      const msg =
        err instanceof Error ? err.message : "Stripe portal failed";
      return reply.code(500).send({ error: msg });
    }
  });
}
