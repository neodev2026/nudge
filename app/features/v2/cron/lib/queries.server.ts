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
// dispatch — next session auto-send
// ---------------------------------------------------------------------------

/**
 * Fetches all users who have at least one completed session today
 * but no pending/in_progress session.
 * Used by dispatch to auto-send the next session.
 */
export async function getCronUsersNeedingNextSession(
  client: SupabaseClient<Database>
) {
  // Users with a completed new-learning session
  const { data, error } = await client
    .from("nv2_sessions")
    .select(
      `
      sns_type,
      sns_id,
      product_session_id,
      session_kind,
      nv2_product_sessions!inner ( id, product_id, session_number )
    `
    )
    .eq("status", "completed")
    .eq("session_kind", "new")
    .order("completed_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetches all users with a pending or in_progress session
 * whose dm_sent_at is older than 20 hours (nudge eligible).
 */
export async function getCronSessionsNeedingNudge(
  client: SupabaseClient<Database>
) {
  const twenty_hours_ago = new Date(
    Date.now() - 20 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await client
    .from("nv2_sessions")
    .select("session_id, sns_type, sns_id, product_session_id, status, dm_sent_at")
    .in("status", ["pending", "in_progress"])
    .lt("dm_sent_at", twenty_hours_ago);

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetches all stage progress rows due for review dispatch.
 * (next_review_at <= now AND review_status is pending)
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
    .eq("nv2_stages.stage_type", "learning") // Only learning stages — exclude welcome/quiz/congratulations
    .order("next_review_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Review session creation
// ---------------------------------------------------------------------------

/**
 * Finds the product_session that contains the given stage_id.
 * Used to create a review session for a specific stage's parent session.
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
      nv2_product_sessions!inner ( id, product_id, session_number, title, is_active )
    `
    )
    .eq("stage_id", stage_id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Creates a review session for a user.
 * Sets session_kind = 'review' and review_round.
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
 * Creates a new learning session for a user (used by cron dispatch).
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

// ---------------------------------------------------------------------------
// review-schedule — next review interval calculation
// ---------------------------------------------------------------------------

/**
 * Calculates the next review date based on round and retry_count.
 *
 * Interval halving rule:
 *   If retry_count >= 3, the interval is halved.
 *   e.g. round 3 = +7 days → +3.5 days (= +3 days 12 hours)
 */
export function calcNextReviewAt(
  round: number,
  retry_count: number
): Date {
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
export function nextReviewStatus(
  current: string
): string {
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
 * Advances review_status and sets next_review_at for the next round.
 *
 * @param stage_ids   — stage IDs completed in this review session
 * @param review_round — current review round (1~4)
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
// daily-reset
// ---------------------------------------------------------------------------

/**
 * Resets today_new_count and today_review_count to 0 for all active profiles.
 * Called by cron daily-reset at midnight UTC.
 */
export async function resetCronDailyCounters(
  client: SupabaseClient<Database>
) {
  const { error } = await client
    .from("nv2_profiles")
    .update({ today_new_count: 0, today_review_count: 0 })
    .eq("is_active", true);

  if (error) throw error;
}
