import { computePeriodKey, supabase } from "../db";
import { UserEntitlement } from "../entitlements/service";

export interface UsageStatus {
  used: number;
  remaining: number;
  periodKey: string;
}

export async function getUsageStatus(
  userId: string,
  entitlement: UserEntitlement
): Promise<UsageStatus> {
  const periodKey = computePeriodKey(entitlement.periodType);
  const { data, error } = await supabase
    .from("usage_counters")
    .select("used_count")
    .eq("user_id", userId)
    .eq("period_key", periodKey)
    .eq("period_type", entitlement.periodType)
    .maybeSingle<{ used_count: number }>();

  if (error) {
    throw new Error(`Failed to get usage status: ${error.message}`);
  }

  const used = data?.used_count ?? 0;
  const remaining = Math.max(0, entitlement.maxQuestions - used);
  return { used, remaining, periodKey };
}

export async function consumeUsage(
  userId: string,
  entitlement: UserEntitlement,
  question: string
): Promise<UsageStatus> {
  const status = await getUsageStatus(userId, entitlement);
  if (status.remaining <= 0) {
    return status;
  }

  const periodKey = status.periodKey;
  const nextUsed = status.used + 1;

  const { error: upsertError } = await supabase.from("usage_counters").upsert(
    {
      user_id: userId,
      period_key: periodKey,
      period_type: entitlement.periodType,
      used_count: nextUsed
    },
    { onConflict: "user_id,period_type,period_key" }
  );

  if (upsertError) {
    throw new Error(`Failed to update usage counter: ${upsertError.message}`);
  }

  const { error: eventError } = await supabase.from("usage_events").insert({
    user_id: userId,
    period_key: periodKey,
    question
  });

  if (eventError) {
    throw new Error(`Failed to insert usage event: ${eventError.message}`);
  }

  return {
    used: nextUsed,
    remaining: Math.max(0, entitlement.maxQuestions - nextUsed),
    periodKey
  };
}
