import "dotenv/config";
import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional()
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  APP_ORIGIN: z.string().default("http://localhost:5173"),
  APP_JWT_SECRET: z.string().min(16),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  GOOGLE_CLIENT_ID: z.string().min(10),
  GOOGLE_CLIENT_SECRET: z.string().min(10),
  GOOGLE_REDIRECT_URI: z.string().url(),
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRICE_PRO_MONTHLY: optionalString,
  STRIPE_SUCCESS_URL: optionalUrl,
  STRIPE_CANCEL_URL: optionalUrl
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid backend env:\n${details}`);
}

export const config = parsed.data;
export const stripeEnabled =
  Boolean(config.STRIPE_SECRET_KEY) &&
  Boolean(config.STRIPE_WEBHOOK_SECRET) &&
  Boolean(config.STRIPE_PRICE_PRO_MONTHLY) &&
  Boolean(config.STRIPE_SUCCESS_URL) &&
  Boolean(config.STRIPE_CANCEL_URL);
