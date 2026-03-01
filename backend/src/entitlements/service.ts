import { DbSubscription, FREE_ENTITLEMENTS, PRO_ENTITLEMENTS, supabase } from "../db";

export interface UserEntitlement {
  plan: "free" | "pro";
  maxAgents: number;
  periodType: "daily" | "monthly";
  maxQuestions: number;
}

export async function resolveEntitlement(userId: string): Promise<UserEntitlement> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("id,user_id,stripe_subscription_id,status,plan_code,current_period_end")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<DbSubscription>();

  if (error) {
    throw new Error(`Failed to fetch subscription: ${error.message}`);
  }

  const isActive = data && ["active", "trialing", "past_due"].includes(data.status);
  if (isActive && data.plan_code === "pro") {
    return { ...PRO_ENTITLEMENTS };
  }
  return { ...FREE_ENTITLEMENTS };
}
