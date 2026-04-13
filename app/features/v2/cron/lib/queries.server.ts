/**
 * Cron query helpers.
 *
 * All queries use the service-role client (bypasses RLS).
 * Called exclusively from cron API endpoints.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import { REVIEW_INTERVALS_DAYS } from "~/features/v2/shared/constants";
import type { SnsType } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// daily-reset
// ---------------------------------------------------------------------------

/**
 * Returns profiles whose local midnight falls within the current 30-minute window.
 * Used by enqueue-daily and daily-reset to target the correct timezone cohort.
 *
 * Matches profiles where:
 *   EXTRACT(HOUR   FROM now() AT TIME ZONE timezone) = target_hour
 *   EXTRACT(MINUTE FROM now() AT TIME ZONE timezone) < 30
 */
export async function getProfilesInLocalTimeWindow(
  client: SupabaseClient<Database>,
  target_hour: number
) {
  // Supabase JS does not support AT TIME ZONE in .filter() — use RPC or raw SQL via
  // the postgres client. Here we fetch all active profiles and filter in JS,
  // which is acceptable for the current user volume (beta stage).
  const { data, error } = await client
    .from("nv2_profiles")
    .select("sns_type, sns_id, timezone, send_hour, daily_goal_new, daily_goal_review")
    .eq("is_active", true);

  if (error) throw error;

  const now = new Date();

  return (data ?? []).filter((profile) => {
    try {
      // Convert UTC now to the user's local time
      const local_time_str = now.toLocaleString("en-US", {
        timeZone: profile.timezone,
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      });
      // en-US numeric format returns "HH:MM" or "H:MM"
      const [h, m] = local_time_str.split(":").map(Number);
      return h === target_hour && m < 30;
    } catch {
      // Invalid timezone — skip
      return false;
    }
  });
}

/**
 * Resets today_new_count and today_review_count to 0 for profiles
 * whose local midnight falls in the current 30-minute window.
 * Called by cron daily-reset (runs every 30 minutes).
 */
export async function resetCronDailyCounters(
  client: SupabaseClient<Database>
) {
  const profiles = await getProfilesInLocalTimeWindow(client, 0); // hour 0 = midnight

  if (profiles.length === 0) return { reset_count: 0 };

  const keys = profiles.map((p) => ({ sns_type: p.sns_type, sns_id: p.sns_id }));

  // Batch update — one update per profile (SNS composite key, no bulk update shortcut)
  let reset_count = 0;
  for (const key of keys) {
    const { error } = await client
      .from("nv2_profiles")
      .update({ today_new_count: 0, today_review_count: 0 })
      .eq("sns_type", key.sns_type)
      .eq("sns_id", key.sns_id);

    if (!error) reset_count++;
  }

  return { reset_count };
}

// ---------------------------------------------------------------------------
// enqueue-daily helpers
// ---------------------------------------------------------------------------

/**
 * Returns all active (pending / in_progress) sessions for a given user.
 * Used by enqueue-daily to decide whether to re-enqueue an existing session
 * or create a new one.
 */
export async function getCronActiveSessionsForUser(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string
) {
  const { data, error } = await client
    .from("nv2_sessions")
    .select(
      `
      session_id,
      product_session_id,
      status,
      session_kind,
      nv2_product_sessions!inner ( id, product_id, session_number, title )
    `
    )
    .eq("sns_type", sns_type)
    .eq("sns_id", sns_id)
    .in("status", ["pending", "in_progress"]);

  if (error) throw error;
  return data ?? [];
}

/**
 * Returns all subscriptions (active products) for a given user.
 * Used by enqueue-daily to iterate over all products the user is learning.
 */
export async function getCronUserSubscriptions(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string
) {
  const { data, error } = await client
    .from("nv2_subscriptions")
    .select(`
      id, product_id, is_active,
      nv2_learning_products!inner(name)
    `)
    .eq("sns_type", sns_type)
    .eq("sns_id", sns_id)
    .eq("is_active", true);

  if (error) throw error;
  return (data ?? []).map((s) => ({
    ...s,
    product_name: (s.nv2_learning_products as any)?.name ?? "",
  }));
}

/**
 * Finds the next product session the user has not yet started.
 * Returns null when all sessions are completed.
 */
export async function getCronNextUnstartedProductSession(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string,
  product_id: string
) {
  const { data: completed, error: completed_error } = await client
    .from("nv2_sessions")
    .select("product_session_id")
    .eq("sns_type", sns_type)
    .eq("sns_id", sns_id)
    .eq("status", "completed");

  if (completed_error) throw completed_error;

  const completed_ids = (completed ?? []).map((r) => r.product_session_id);

  let query = client
    .from("nv2_product_sessions")
    .select("id, session_number, title")
    .eq("product_id", product_id)
    .eq("is_active", true)
    .order("session_number", { ascending: true })
    .limit(1);

  if (completed_ids.length > 0) {
    query = query.not(
      "id",
      "in",
      `(${completed_ids.map((id) => `"${id}"`).join(",")})`
    );
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Creates a new user session for cron-initiated delivery.
 */
export async function createCronNewSession(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string,
  product_session_id: string,
  dm_sent_at: string
) {
  const { data, error } = await client
    .from("nv2_sessions")
    .insert({
      sns_type,
      sns_id,
      product_session_id,
      session_kind: "new",
      status: "pending",
      dm_sent_at,
    })
    .select("session_id")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Creates a new review session for cron-initiated delivery.
 */
export async function createCronReviewSession(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string,
  product_session_id: string,
  review_round: number,
  dm_sent_at: string
) {
  const { data, error } = await client
    .from("nv2_sessions")
    .insert({
      sns_type,
      sns_id,
      product_session_id,
      session_kind: "review",
      review_round,
      status: "pending",
      dm_sent_at,
    })
    .select("session_id")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Checks whether a schedule entry for the given user/type/date already exists.
 * Used to prevent duplicate enqueue on repeated 30-minute Cron runs.
 *
 * @param date_prefix - ISO date string prefix, e.g. "2026-04-08"
 */
export async function getCronScheduleExistsToday(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string,
  schedule_type: "new" | "review" | "cheer" | "welcome",
  date_prefix: string
) {
  const { data, error } = await client
    .from("nv2_schedules")
    .select("schedule_id")
    .eq("sns_type", sns_type)
    .eq("sns_id", sns_id)
    .eq("schedule_type", schedule_type)
    .gte("scheduled_at", `${date_prefix}T00:00:00Z`)
    .lt("scheduled_at", `${date_prefix}T23:59:59Z`)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/**
 * Checks whether a cheer schedule already exists for a given user and local hour today.
 */
export async function getCronCheerExistsTodayForHour(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string,
  local_hour: number,
  date_prefix: string
) {
  // We store local_hour in message_body prefix as "cheer:HH" for dedup
  const hour_tag = `cheer:${String(local_hour).padStart(2, "0")}`;

  const { data, error } = await client
    .from("nv2_schedules")
    .select("schedule_id")
    .eq("sns_type", sns_type)
    .eq("sns_id", sns_id)
    .eq("schedule_type", "cheer")
    .like("message_body", `${hour_tag}|%`)
    .gte("scheduled_at", `${date_prefix}T00:00:00Z`)
    .lt("scheduled_at", `${date_prefix}T23:59:59Z`)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

/**
 * Inserts a schedule row into nv2_schedules.
 */
export async function insertCronSchedule(
  client: SupabaseClient<Database>,
  row: {
    sns_type: SnsType;
    sns_id: string;
    schedule_type: "new" | "review" | "cheer" | "welcome";
    delivery_url: string;
    message_body?: string;
    scheduled_at: string;
    review_round?: number;
  }
) {
  const { error } = await client.from("nv2_schedules").insert({
    sns_type: row.sns_type,
    sns_id: row.sns_id,
    schedule_type: row.schedule_type,
    delivery_url: row.delivery_url,
    message_body: row.message_body ?? null,
    scheduled_at: row.scheduled_at,
    review_round: row.review_round ?? null,
    status: "pending",
  });

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

/**
 * Fetches all pending schedule rows where scheduled_at <= now().
 * This is the main dispatch query — Cron runs every 5 minutes.
 */
export async function getCronPendingSchedules(
  client: SupabaseClient<Database>
) {
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("nv2_schedules")
    .select(
      "schedule_id, sns_type, sns_id, schedule_type, delivery_url, message_body, review_round, retry_count, max_retries"
    )
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(100); // Safety cap per run

  if (error) throw error;
  return data ?? [];
}

/**
 * Marks a schedule row as sent.
 */
export async function markCronScheduleSent(
  client: SupabaseClient<Database>,
  schedule_id: bigint
) {
  const { error } = await client
    .from("nv2_schedules")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("schedule_id", Number(schedule_id));

  if (error) throw error;
}

/**
 * Marks a schedule row as failed or increments retry_count.
 * If retry_count >= max_retries, sets status = 'failed'.
 * Otherwise increments retry_count and leaves status = 'pending' for retry.
 */
export async function markCronScheduleFailedOrRetry(
  client: SupabaseClient<Database>,
  schedule_id: bigint,
  error_message: string,
  current_retry_count: number,
  max_retries: number
) {
  const exhausted = current_retry_count + 1 >= max_retries;

  const { error } = await client
    .from("nv2_schedules")
    .update({
      status: exhausted ? "failed" : "pending",
      retry_count: current_retry_count + 1,
      error_message,
    })
    .eq("schedule_id", Number(schedule_id));

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// enqueue-nudge helpers
// ---------------------------------------------------------------------------

/**
 * Returns users who have at least one incomplete (pending / in_progress) session.
 * Used by enqueue-nudge to find cheer DM candidates.
 */
export async function getCronUsersWithIncompleteSessions(
  client: SupabaseClient<Database>
) {
  const { data, error } = await client
    .from("nv2_sessions")
    .select(`
      sns_type, sns_id, session_id, product_session_id,
      nv2_product_sessions!inner(
        session_number, title,
        nv2_learning_products!inner(name)
      )
    `)
    .in("status", ["pending", "in_progress"]);

  if (error) throw error;

  // Deduplicate by (sns_type, sns_id) — keep first session per user
  const seen = new Set<string>();
  const unique: Array<{
    sns_type: string;
    sns_id: string;
    session_id: string;
    product_session_id: string;
    product_name: string;
    session_number: number;
    session_title: string;
  }> = [];
  for (const row of data ?? []) {
    const key = `${row.sns_type}:${row.sns_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      const ps = (row.nv2_product_sessions as any);
      unique.push({
        sns_type: row.sns_type,
        sns_id: row.sns_id,
        session_id: row.session_id,
        product_session_id: row.product_session_id,
        product_name: ps?.nv2_learning_products?.name ?? "",
        session_number: ps?.session_number ?? 0,
        session_title: ps?.title ?? "",
      });
    }
  }
  return unique;
}

// ---------------------------------------------------------------------------
// Review scheduling
// ---------------------------------------------------------------------------

/**
 * Fetches stage progress rows due for review dispatch.
 */
export async function getCronStageProgressDueForReview(
  client: SupabaseClient<Database>
) {
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("nv2_stage_progress")
    .select(
      `
      progress_id,
      sns_type,
      sns_id,
      stage_id,
      review_status,
      review_round,
      retry_count,
      next_review_at,
      nv2_stages!inner ( id, learning_product_id, stage_number, title, stage_type )
    `
    )
    .in("review_status", ["r1_pending", "r2_pending", "r3_pending", "r4_pending"])
    .lte("next_review_at", now)
    .eq("nv2_stages.stage_type", "learning")
    .order("next_review_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * Finds the product_session that contains the given stage_id.
 */
export async function getProductSessionContainingStage(
  client: SupabaseClient<Database>,
  stage_id: string
) {
  const { data, error } = await client
    .from("nv2_product_session_stages")
    .select(
      `
      product_session_id,
      nv2_product_sessions!inner (
        id, product_id, session_number, title, is_active,
        nv2_learning_products!inner(name)
      )
    `
    )
    .eq("stage_id", stage_id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Calculates the next review date based on round and retry_count.
 * If retry_count >= 3, the interval is halved.
 */
export function calcNextReviewAt(round: number, retry_count: number): Date {
  const base_days = REVIEW_INTERVALS_DAYS[round] ?? 1;
  const halved = retry_count >= 3;
  const hours = halved
    ? Math.round((base_days * 24) / 2)
    : base_days * 24;

  const next = new Date();
  next.setUTCHours(next.getUTCHours() + hours);
  return next;
}

/**
 * Maps review_status to the next status after completing a review.
 */
export function nextReviewStatus(current: string): string {
  const map: Record<string, string> = {
    r1_pending: "r2_pending",
    r2_pending: "r3_pending",
    r3_pending: "r4_pending",
    r4_pending: "mastered",
  };
  return map[current] ?? "mastered";
}

/**
 * Updates stage progress after a review session is completed.
 */
export async function advanceCronReviewProgress(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string,
  stage_ids: string[],
  review_round: number
) {
  for (const stage_id of stage_ids) {
    const { data: progress } = await client
      .from("nv2_stage_progress")
      .select("progress_id, review_status, retry_count")
      .eq("sns_type", sns_type)
      .eq("sns_id", sns_id)
      .eq("stage_id", stage_id)
      .maybeSingle();

    if (!progress) continue;

    const new_status = nextReviewStatus(progress.review_status);
    const is_mastered = new_status === "mastered";

    const update: Record<string, unknown> = {
      review_status: new_status,
      review_round: is_mastered ? null : review_round + 1,
      last_review_completed_at: new Date().toISOString(),
    };

    if (!is_mastered) {
      const next_at = calcNextReviewAt(review_round + 1, progress.retry_count);
      update.next_review_at = next_at.toISOString();
    } else {
      update.next_review_at = null;
    }

    await client
      .from("nv2_stage_progress")
      .update(update)
      .eq("progress_id", Number(progress.progress_id));
  }
}

// ---------------------------------------------------------------------------
// Chat turn retention
// ---------------------------------------------------------------------------

/**
 * Deletes nv2_chat_turns older than CHAT_TURN_RETENTION_DAYS (default 90).
 *
 * Retention period is controlled by the CHAT_TURN_RETENTION_DAYS environment
 * variable so it can be adjusted without a code deploy.
 *
 * Called nightly by daily-reset cron.
 */
export async function purgeStaleChatTurns(
  client: SupabaseClient<Database>
): Promise<{ purged_chat_turns: number }> {
  const retention_days = parseInt(
    process.env.CHAT_TURN_RETENTION_DAYS ?? "90",
    10
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retention_days);

  const { error, count } = await client
    .from("nv2_chat_turns")
    .delete({ count: "exact" })
    .lt("created_at", cutoff.toISOString());

  if (error) throw error;

  return { purged_chat_turns: count ?? 0 };
}
