import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

export type PlanCode = "free" | "pro";

export interface DbUser {
  id: string;
  email: string;
  google_sub: string;
  full_name: string | null;
  avatar_url: string | null;
  stripe_customer_id: string | null;
}

export interface DbSubscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  status: string;
  plan_code: PlanCode;
  current_period_end: string | null;
}

export interface Entitlements {
  plan: PlanCode;
  maxAgents: number;
  periodType: "daily" | "monthly";
  maxQuestions: number;
  allowWebData: boolean;
  allowForecast: boolean;
  allowDebate: boolean;
  allowExpertProfile: boolean;
  allowMemory: boolean;
}

export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export const FREE_ENTITLEMENTS: Entitlements = {
  plan: "free",
  maxAgents: 2,
  periodType: "daily",
  maxQuestions: 15,
  allowWebData: false,
  allowForecast: false,
  allowDebate: false,
  allowExpertProfile: false,
  allowMemory: false
};

export const PRO_ENTITLEMENTS: Entitlements = {
  plan: "pro",
  maxAgents: 4,
  periodType: "monthly",
  maxQuestions: 500,
  allowWebData: true,
  allowForecast: true,
  allowDebate: true,
  allowExpertProfile: true,
  allowMemory: true
};

export function computePeriodKey(periodType: "daily" | "monthly", now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  if (periodType === "monthly") {
    return `${year}-${month}`;
  }
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
