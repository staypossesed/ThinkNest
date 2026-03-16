import { computePeriodKey, supabase } from "../db";
import { UserEntitlement } from "../entitlements/service";

export interface UsageStatus {
  used: number;
  remaining: number;
  periodKey: string;
}

/** Статус мульти-ответа: 100/неделю, обычный ответ — безлимит */
export async function getMultiAnswerUsageStatus(userId: string, entitlement: UserEntitlement): Promise<UsageStatus> {
  const periodKey = computePeriodKey("weekly");
  const { data, error } = await supabase
    .from("usage_counters")
    .select("used_count")
    .eq("user_id", userId)
    .eq("period_key", periodKey)
    .eq("period_type", "weekly")
    .maybeSingle<{ used_count: number }>();

  if (error) {
    throw new Error(`Failed to get multi-answer usage status: ${error.message}`);
  }

  const used = data?.used_count ?? 0;
  const max = entitlement.maxMultiAnswer ?? 100;
  const remaining = Math.max(0, max - used);
  return { used, remaining, periodKey };
}

export async function getUsageStatus(
  userId: string,
  entitlement: UserEntitlement
): Promise<UsageStatus> {
  return getMultiAnswerUsageStatus(userId, entitlement);
}

export async function consumeUsage(
  userId: string,
  entitlement: UserEntitlement,
  question: string,
  count = 1
): Promise<UsageStatus> {
  if (count <= 1) {
    return getMultiAnswerUsageStatus(userId, entitlement);
  }

  const status = await getMultiAnswerUsageStatus(userId, entitlement);
  const consumeAmount = 1;
  if (status.remaining < consumeAmount) {
    return status;
  }

  const periodKey = status.periodKey;
  const nextUsed = status.used + consumeAmount;

  const { error: upsertError } = await supabase.from("usage_counters").upsert(
    {
      user_id: userId,
      period_key: periodKey,
      period_type: "weekly",
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

  const max = entitlement.maxMultiAnswer ?? 100;
  return {
    used: nextUsed,
    remaining: Math.max(0, max - nextUsed),
    periodKey
  };
}
