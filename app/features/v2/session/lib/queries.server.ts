import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

// ---------------------------------------------------------------------------
// Product session queries
// ---------------------------------------------------------------------------

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
 * Returns null when all sessions are completed.
 */
export async function getNv2NextUnstartedProductSession(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  product_id: string
) {
  const { data: completed, error: completed_error } = await client
    .from("nv2_sessions")
    .select("product_session_id")
    .eq("auth_user_id", auth_user_id)
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
    query = query.not("id", "in", `(${completed_ids.map((id) => `"${id}"`).join(",")})`);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// User session queries
// ---------------------------------------------------------------------------

export async function getNv2ActiveUserSession(
  client: SupabaseClient<Database>,
  auth_user_id: string,
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
    .eq("auth_user_id", auth_user_id)
    .eq("nv2_product_sessions.product_id", product_id)
    .neq("status", "completed")
    .order("session_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Fetches auth_user_id and link_access for a session.
 * Used by session-page and stage-page to resolve user identity
 * without requiring authentication (for public link_access sessions).
 * Security token: the unguessable session_id UUID.
 */
export async function getSessionIdentity(
  client: SupabaseClient<Database>,
  session_id: string
) {
  const { data, error } = await client
    .from("nv2_sessions")
    .select(
      `
      session_id,
      auth_user_id,
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

  const { data: ps } = await client
    .from("nv2_product_sessions")
    .select("product_id")
    .eq("id", data.product_session_id)
    .maybeSingle();

  const { data: sub } = await client
    .from("nv2_subscriptions")
    .select("link_access")
    .eq("auth_user_id", data.auth_user_id)
    .eq("product_id", ps?.product_id ?? "")
    .maybeSingle();

  return {
    session_id: data.session_id,
    auth_user_id: data.auth_user_id,
    product_session_id: data.product_session_id,
    session_kind: data.session_kind,
    review_round: data.review_round,
    status: data.status,
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

export async function createNv2UserSession(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  product_session_id: string
) {
  const { data, error } = await client
    .from("nv2_sessions")
    .insert({
      auth_user_id,
      product_session_id,
      session_kind: "new",
      status: "pending",
      dm_sent_at: new Date().toISOString(),
    })
    .select("session_id")
    .single();

  if (error) {
    // Unique constraint violation — active new session already exists; return it
    if (error.code === "23505") {
      const { data: existing, error: sel_err } = await client
        .from("nv2_sessions")
        .select("session_id")
        .eq("auth_user_id", auth_user_id)
        .eq("product_session_id", product_session_id)
        .eq("session_kind", "new")
        .neq("status", "completed")
        .maybeSingle();
      if (sel_err) throw sel_err;
      if (!existing) throw error;
      return existing;
    }
    throw error;
  }
  return data;
}

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
    .neq("status", "completed")
    .select("session_id, product_session_id")
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export async function upsertNv2Subscription(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  product_id: string
) {
  const { data: existing } = await client
    .from("nv2_subscriptions")
    .select("id, link_access")
    .eq("auth_user_id", auth_user_id)
    .eq("product_id", product_id)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await client
    .from("nv2_subscriptions")
    .insert({
      auth_user_id,
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
