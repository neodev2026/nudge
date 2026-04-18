import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

// ---------------------------------------------------------------------------
// Stage + Cards
// ---------------------------------------------------------------------------

/**
 * Fetches a single active stage with all its active cards ordered by display_order.
 * Returns null when the stage does not exist or is not active.
 *
 * Used by the stage page loader — accessible without authentication.
 */
export async function getNv2StageWithCards(
  client: SupabaseClient<Database>,
  stage_id: string
) {
  const { data, error } = await client
    .from("nv2_stages")
    .select(
      `
      id,
      learning_product_id,
      stage_number,
      stage_type,
      title,
      is_active,
      nv2_cards (
        id,
        card_type,
        display_order,
        card_data,
        is_active
      )
    `
    )
    .eq("id", stage_id)
    .eq("is_active", true)
    .order("display_order", { referencedTable: "nv2_cards", ascending: true })
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Filter out inactive cards — the RLS policy already restricts to active,
  // but we guard here too in case of anon access or policy changes.
  return {
    ...data,
    nv2_cards: data.nv2_cards.filter((c) => c.is_active),
  };
}

/**
 * Fetches the first active welcome stage across all products.
 * Used by discord-callback to resolve the welcome DM link.
 * Returns null when no welcome stage exists yet.
 */
export async function getNv2WelcomeStage(client: SupabaseClient<Database>) {
  const { data, error } = await client
    .from("nv2_stages")
    .select("id, title, learning_product_id")
    .eq("stage_type", "welcome")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Fetches the first active learning stage for a product.
 * Used by product-detail-page to redirect directly to stage 1.
 */
export async function getNv2FirstStage(
  client: SupabaseClient<Database>,
  learning_product_id: string
) {
  const { data, error } = await client
    .from("nv2_stages")
    .select("id, stage_number, title, stage_type")
    .eq("learning_product_id", learning_product_id)
    .eq("is_active", true)
    .eq("stage_type", "learning")
    .order("stage_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data; // null when no stages exist yet
}

// ---------------------------------------------------------------------------
// Stage Progress
// ---------------------------------------------------------------------------

/**
 * Fetches a user's progress row for a specific stage.
 * Returns null when no progress exists yet (first time viewing the stage).
 */
export async function getNv2StageProgress(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  stage_id: string
) {
  const { data, error } = await client
    .from("nv2_stage_progress")
    .select("*")
    .eq("auth_user_id", auth_user_id)
    .eq("stage_id", stage_id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Creates a progress row when a user first opens a stage.
 * Safe to call multiple times — does nothing if the row already exists.
 */
export async function initNv2StageProgress(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  stage_id: string
) {
  // Check if a progress row already exists before inserting.
  const { data: existing } = await client
    .from("nv2_stage_progress")
    .select("progress_id")
    .eq("auth_user_id", auth_user_id)
    .eq("stage_id", stage_id)
    .maybeSingle();

  if (existing) return; // Row already exists — nothing to do

  const { error } = await client.from("nv2_stage_progress").insert({
    auth_user_id,
    stage_id,
  });

  if (error) throw error;
}

/**
 * Increments retry_count for a progress row.
 * Called by POST /api/v2/stage/:stageId/retry.
 */
export async function incrementNv2StageRetry(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  stage_id: string
) {
  const { data: current, error: fetchError } = await client
    .from("nv2_stage_progress")
    .select("progress_id, retry_count")
    .eq("auth_user_id", auth_user_id)
    .eq("stage_id", stage_id)
    .single();

  if (fetchError) throw fetchError;

  const { error: updateError } = await client
    .from("nv2_stage_progress")
    .update({ retry_count: current.retry_count + 1 })
    .eq("progress_id", current.progress_id);

  if (updateError) throw updateError;
}

/**
 * Marks a stage as completed.
 *
 * Two behaviours depending on whether the stage was already completed:
 *
 *   First completion (completed_at IS NULL):
 *     Sets completed_at, review_status = "r1_pending", review_round = 1,
 *     and next_review_at = now + 1 day.
 *     Returns the progress row (progress_id, retry_count).
 *
 *   Subsequent completion in a review session (completed_at IS NOT NULL):
 *     Sets last_review_completed_at = now only.
 *     Does NOT touch review_status / review_round / next_review_at
 *     — those are managed exclusively by the Cron dispatcher.
 *     Returns null (same as the idempotent path).
 *
 * Called by:
 *   - POST /api/v2/stage/:stageId/complete  (learning stages)
 *   - POST /api/v2/quiz/:stageId/result     (quiz stages)
 *   - POST /api/v2/sentence/:stageId/result
 *   - POST /api/v2/dictation/:stageId/result
 *   - POST /api/v2/writing/:stageId/result
 */
export async function completeNv2Stage(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  stage_id: string
) {
  const now = new Date();

  // Attempt first-completion update (guard: completed_at IS NULL)
  const next_review_at = new Date(now);
  next_review_at.setUTCDate(next_review_at.getUTCDate() + 1);

  const { data, error } = await client
    .from("nv2_stage_progress")
    .update({
      completed_at: now.toISOString(),
      review_status: "r1_pending",
      review_round: 1,
      next_review_at: next_review_at.toISOString(),
    })
    .eq("auth_user_id", auth_user_id)
    .eq("stage_id", stage_id)
    .is("completed_at", null)
    .select("progress_id, retry_count")
    .maybeSingle();

  if (error) throw error;

  // data is non-null → first completion succeeded, nothing more to do.
  if (data) return data;

  // data is null → stage was already completed (review session).
  // Update last_review_completed_at so the session-page can detect
  // that this stage was reviewed in the current session.
  const { error: review_error } = await client
    .from("nv2_stage_progress")
    .update({ last_review_completed_at: now.toISOString() })
    .eq("auth_user_id", auth_user_id)
    .eq("stage_id", stage_id);

  if (review_error) throw review_error;

  return null;
}

/**
 * Increments today_new_count on the user's profile.
 * Called after a stage is successfully completed for the first time.
 */
export async function incrementNv2TodayNewCount(
  client: SupabaseClient<Database>,
  auth_user_id: string
) {
  const { data: profile, error: fetchError } = await client
    .from("nv2_profiles")
    .select("today_new_count")
    .eq("auth_user_id", auth_user_id)
    .single();

  if (fetchError) throw fetchError;

  const { error: updateError } = await client
    .from("nv2_profiles")
    .update({ today_new_count: profile.today_new_count + 1 })
    .eq("auth_user_id", auth_user_id);

  if (updateError) throw updateError;
}

/**
 * Fetches the next unstarted learning stage for a user within a product.
 * Used after stage completion to find the stage_id for the next schedule.
 */
export async function getNv2NextStage(
  client: SupabaseClient<Database>,
  learning_product_id: string,
  current_stage_number: number
) {
  const { data, error } = await client
    .from("nv2_stages")
    .select("id, stage_number, title")
    .eq("learning_product_id", learning_product_id)
    .eq("is_active", true)
    .eq("stage_type", "learning")
    .gt("stage_number", current_stage_number)
    .order("stage_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data; // null when current stage is the last one
}
