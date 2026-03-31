import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import type { SnsType } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// Product session queries
// ---------------------------------------------------------------------------

/**
 * Fetches a product session with its ordered stages.
 * Used by the session page loader.
 */
export async function getNv2ProductSessionWithStages(
  client: SupabaseClient<Database>,
  product_session_id: string
) {
  const { data, error } = await client
    .from("nv2_product_sessions")
    .select(
      `
      id,
      product_id,
      session_number,
      title,
      is_active,
      nv2_product_session_stages (
        id,
        stage_id,
        display_order,
        nv2_stages (
          id,
          stage_number,
          stage_type,
          title,
          is_active
        )
      )
    `
    )
    .eq("id", product_session_id)
    .eq("is_active", true)
    .order("display_order", {
      referencedTable: "nv2_product_session_stages",
      ascending: true,
    })
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Fetches the next active product session after the given session_number.
 * Returns null when the current session is the last one.
 */
export async function getNv2NextProductSession(
  client: SupabaseClient<Database>,
  product_id: string,
  current_session_number: number
) {
  const { data, error } = await client
    .from("nv2_product_sessions")
    .select("id, session_number, title")
    .eq("product_id", product_id)
    .eq("is_active", true)
    .gt("session_number", current_session_number)
    .order("session_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Fetches the first active product session for a product.
 * Used when a user starts a product for the first time.
 */
export async function getNv2FirstProductSession(
  client: SupabaseClient<Database>,
  product_id: string
) {
  const { data, error } = await client
    .from("nv2_product_sessions")
    .select("id, session_number, title")
    .eq("product_id", product_id)
    .eq("is_active", true)
    .order("session_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Finds the next product session the user has not yet started.
 *
 * Logic:
 *   1. Fetch all completed nv2_sessions for this user + product
 *   2. Find the lowest session_number product_session not in that list
 *
 * Returns null when all sessions are completed.
 */
export async function getNv2NextUnstartedProductSession(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string,
  product_id: string
) {
  // Fetch all product_session_ids the user has already completed
  const { data: completed, error: completed_error } = await client
    .from("nv2_sessions")
    .select("product_session_id")
    .eq("sns_type", sns_type)
    .eq("sns_id", sns_id)
    .eq("status", "completed");

  if (completed_error) throw completed_error;

  const completed_ids = (completed ?? []).map((r) => r.product_session_id);

  // Find the lowest session_number product_session not yet completed
  let query = client
    .from("nv2_product_sessions")
    .select("id, session_number, title")
    .eq("product_id", product_id)
    .eq("is_active", true)
    .order("session_number", { ascending: true })
    .limit(1);

  // Exclude completed sessions if any exist
  if (completed_ids.length > 0) {
    query = query.not("id", "in", `(${completed_ids.map((id) => `"${id}"`).join(",")})`);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data; // null when all sessions completed
}

// ---------------------------------------------------------------------------
// User session queries
// ---------------------------------------------------------------------------

/**
 * Fetches the user's current active (pending or in_progress) session
 * for a given product.
 * Returns null when no active session exists.
 */
export async function getNv2ActiveUserSession(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string,
  product_id: string
) {
  const { data, error } = await client
    .from("nv2_sessions")
    .select(
      `
      session_id,
      product_session_id,
      status,
      dm_sent_at,
      started_at,
      nv2_product_sessions!inner (
        id,
        product_id,
        session_number
      )
    `
    )
    .eq("sns_type", sns_type)
    .eq("sns_id", sns_id)
    .eq("nv2_product_sessions.product_id", product_id)
    .neq("status", "completed")
    .order("session_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Fetches sns_type, sns_id, and link_access for a session.
 * Used by session-page and stage-page to resolve user identity
 * without requiring authentication (for public link_access sessions).
 */
export async function getSessionIdentity(
  client: SupabaseClient<Database>,
  session_id: string
) {
  // Step 1: Fetch session row (public select policy allows anon access)
  const { data, error } = await client
    .from("nv2_sessions")
    .select(
      `
      session_id,
      sns_type,
      sns_id,
      product_session_id,
      session_kind,
      review_round,
      status
    `
    )
    .eq("session_id", session_id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  // Step 2: Fetch product_id from product_session (public select policy)
  const { data: ps } = await client
    .from("nv2_product_sessions")
    .select("product_id")
    .eq("id", data.product_session_id)
    .maybeSingle();

  // Step 3: Resolve link_access from nv2_subscriptions
  // nv2_subscriptions has no public select policy — use service role or default to 'public'
  // For anon users, sub query will return null → default to 'public'
  const { data: sub } = await client
    .from("nv2_subscriptions")
    .select("link_access")
    .eq("sns_type", data.sns_type)
    .eq("sns_id", data.sns_id)
    .eq("product_id", ps?.product_id ?? "")
    .maybeSingle();

  return {
    session_id: data.session_id,
    sns_type: data.sns_type as SnsType,
    sns_id: data.sns_id,
    product_session_id: data.product_session_id,
    session_kind: data.session_kind,
    review_round: data.review_round,
    status: data.status,
    // Default to 'public' if no subscription row exists yet
    link_access: (sub?.link_access ?? "public") as "public" | "members_only",
  };
}


export async function getNv2UserSession(
  client: SupabaseClient<Database>,
  session_id: string
) {
  const { data, error } = await client
    .from("nv2_sessions")
    .select("*")
    .eq("session_id", session_id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Creates a new user session row.
 * Called by start-learning.tsx after confirming no active session exists.
 */
export async function createNv2UserSession(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string,
  product_session_id: string
) {
  const { data, error } = await client
    .from("nv2_sessions")
    .insert({
      sns_type,
      sns_id,
      product_session_id,
      status: "pending",
      dm_sent_at: new Date().toISOString(),
    })
    .select("session_id")
    .single();

  if (error) throw error;
  return data;
}

/**
 * Marks a user session as in_progress (first stage opened).
 * Idempotent — does nothing if already in_progress or completed.
 */
export async function startNv2UserSession(
  client: SupabaseClient<Database>,
  session_id: string
) {
  const { error } = await client
    .from("nv2_sessions")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .eq("session_id", session_id)
    .eq("status", "pending");

  if (error) throw error;
}

/**
 * Marks a user session as completed.
 * Called by POST /api/v2/sessions/:sessionId/complete.
 * Idempotent — does nothing if already completed.
 */
export async function completeNv2UserSession(
  client: SupabaseClient<Database>,
  session_id: string
) {
  const { data, error } = await client
    .from("nv2_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("session_id", session_id)
    .neq("status", "completed") // Guard: idempotent
    .select("session_id, product_session_id")
    .maybeSingle();

  if (error) throw error;
  return data; // null if already completed
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/**
 * Upserts a subscription row for a user/product pair.
 * Called when:
 *   - User taps "학습 시작" on a product (start-learning.tsx)
 *   - New user completes Discord OAuth (discord-callback.tsx)
 *
 * Uses upsert to avoid duplicates — safe to call multiple times.
 * Does NOT overwrite link_access if a row already exists.
 */
export async function upsertNv2Subscription(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string,
  product_id: string
) {
  // Check if subscription already exists
  const { data: existing } = await client
    .from("nv2_subscriptions")
    .select("id, link_access")
    .eq("sns_type", sns_type)
    .eq("sns_id", sns_id)
    .eq("product_id", product_id)
    .maybeSingle();

  if (existing) return existing; // Already subscribed — preserve existing settings

  // Create new subscription with defaults
  const { data, error } = await client
    .from("nv2_subscriptions")
    .insert({
      sns_type,
      sns_id,
      product_id,
      link_access: "public",
      is_active: true,
      started_at: new Date().toISOString(),
    })
    .select("id, link_access")
    .single();

  if (error) throw error;
  return data;
}
