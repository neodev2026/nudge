/**
 * Admin CRUD queries for Nudge v2 content management.
 * All queries use the authenticated Supabase client — isAdmin RLS applies.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function adminGetAllProducts(client: SupabaseClient<Database>) {
  const { data, error } = await client
    .from("nv2_learning_products")
    .select("id, category, name, slug, icon, is_active, total_stages, display_order, meta")
    .order("display_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function adminGetProductById(
  client: SupabaseClient<Database>,
  id: string
) {
  const { data, error } = await client
    .from("nv2_learning_products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function adminUpsertProduct(
  client: SupabaseClient<Database>,
  product: {
    id?: string;
    category: string;
    name: string;
    slug: string;
    icon?: string | null;
    description?: string | null;
    meta?: Record<string, unknown>;
    display_order?: number;
    is_active?: boolean;
  }
) {
  const { data, error } = await client
    .from("nv2_learning_products")
    .upsert(product as any)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export async function adminGetStagesByProduct(
  client: SupabaseClient<Database>,
  product_id: string
) {
  const { data, error } = await client
    .from("nv2_stages")
    .select("id, stage_number, stage_type, title, is_active")
    .eq("learning_product_id", product_id)
    .order("stage_number", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function adminGetStageWithCards(
  client: SupabaseClient<Database>,
  stage_id: string
) {
  const { data, error } = await client
    .from("nv2_stages")
    .select(`
      id, learning_product_id, stage_number, stage_type, title, is_active,
      nv2_cards (
        id, card_type, display_order, card_data, is_active
      )
    `)
    .eq("id", stage_id)
    .order("display_order", { referencedTable: "nv2_cards", ascending: true })
    .single();

  if (error) throw error;
  return data;
}

export async function adminUpsertStage(
  client: SupabaseClient<Database>,
  stage: {
    id?: string;
    learning_product_id: string;
    stage_number: number;
    stage_type: string;
    title: string;
    is_active?: boolean;
  }
) {
  const { data, error } = await client
    .from("nv2_stages")
    .upsert(stage as any)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function adminDeleteStage(
  client: SupabaseClient<Database>,
  stage_id: string
) {
  const { error } = await client
    .from("nv2_stages")
    .delete()
    .eq("id", stage_id);

  if (error) throw error;
}

export async function adminGetMaxStageNumber(
  client: SupabaseClient<Database>,
  product_id: string
) {
  const { data, error } = await client
    .from("nv2_stages")
    .select("stage_number")
    .eq("learning_product_id", product_id)
    .order("stage_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.stage_number ?? 0;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export async function adminUpsertCard(
  client: SupabaseClient<Database>,
  card: {
    id?: string;
    stage_id: string;
    card_type: string;
    display_order: number;
    card_data: Record<string, unknown>;
    is_active?: boolean;
  }
) {
  const { data, error } = await client
    .from("nv2_cards")
    .upsert(card as any)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function adminDeleteCard(
  client: SupabaseClient<Database>,
  card_id: string
) {
  const { error } = await client
    .from("nv2_cards")
    .delete()
    .eq("id", card_id);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Product Sessions
// ---------------------------------------------------------------------------

export async function adminGetSessionsByProduct(
  client: SupabaseClient<Database>,
  product_id: string
) {
  const { data, error } = await client
    .from("nv2_product_sessions")
    .select(`
      id, session_number, title, is_active,
      nv2_product_session_stages (
        id, stage_id, display_order,
        nv2_stages ( id, title, stage_type, stage_number )
      )
    `)
    .eq("product_id", product_id)
    .order("session_number", { ascending: true })
    .order("display_order", { referencedTable: "nv2_product_session_stages", ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function adminUpsertProductSession(
  client: SupabaseClient<Database>,
  session: {
    id?: string;
    product_id: string;
    session_number: number;
    title?: string | null;
    is_active?: boolean;
  }
) {
  const { data, error } = await client
    .from("nv2_product_sessions")
    .upsert(session)
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function adminDeleteProductSession(
  client: SupabaseClient<Database>,
  session_id: string
) {
  const { error } = await client
    .from("nv2_product_sessions")
    .delete()
    .eq("id", session_id);

  if (error) throw error;
}

/**
 * Replaces all stage assignments for a session.
 * Deletes existing rows and inserts the new ordered list.
 */
export async function adminSetSessionStages(
  client: SupabaseClient<Database>,
  product_session_id: string,
  stage_ids: string[] // ordered list
) {
  // Delete existing assignments
  const { error: del_error } = await client
    .from("nv2_product_session_stages")
    .delete()
    .eq("product_session_id", product_session_id);

  if (del_error) throw del_error;

  if (stage_ids.length === 0) return;

  // Insert new ordered assignments
  const { error: ins_error } = await client
    .from("nv2_product_session_stages")
    .insert(
      stage_ids.map((stage_id, i) => ({
        product_session_id,
        stage_id,
        display_order: i + 1,
      }))
    );

  if (ins_error) throw ins_error;
}

// ---------------------------------------------------------------------------
// Turn balance — Leni AI chat quota management
// ---------------------------------------------------------------------------

/**
 * Fetches all users from auth.users (source of truth) with their
 * nv2_profiles info and turn balance.
 *
 * Requires service_role client (adminClient) — auth.users is not accessible
 * via the regular authenticated client.
 */
export async function adminGetUsersWithTurnBalance(
  client: SupabaseClient<Database>
) {
  // auth.users — requires service_role
  const { data: auth_users_data, error: auth_error } =
    await (client as any).auth.admin.listUsers({ perPage: 1000 });

  if (auth_error) throw auth_error;

  const auth_users: Array<{
    id: string;
    email?: string;
    created_at: string;
  }> = auth_users_data?.users ?? [];

  // nv2_profiles — display_name, sns info
  const { data: profiles } = await client
    .from("nv2_profiles")
    .select("auth_user_id, sns_id, sns_type, display_name, avatar_url");

  const profile_map = Object.fromEntries(
    (profiles ?? [])
      .filter((p) => !!p.auth_user_id)
      .map((p) => [p.auth_user_id as string, p])
  );

  // nv2_turn_balance
  const { data: balances } = await client
    .from("nv2_turn_balance")
    .select("auth_user_id, subscription_turns, charged_turns, subscription_reset_at");

  const balance_map = Object.fromEntries(
    (balances ?? []).map((b) => [b.auth_user_id, b])
  );

  return auth_users.map((u) => {
    const profile = profile_map[u.id];
    const balance = balance_map[u.id];
    return {
      auth_user_id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      // Profile info (null if user hasn't connected Discord yet)
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      sns_type: profile?.sns_type ?? null,
      sns_id: profile?.sns_id ?? null,
      // Turn balance
      subscription_turns: balance?.subscription_turns ?? 0,
      charged_turns: balance?.charged_turns ?? 0,
      subscription_reset_at: balance?.subscription_reset_at ?? null,
    };
  });
}

/**
 * Grants turns to a user (upserts nv2_turn_balance).
 * grant_type: "subscription" resets subscription_turns + sets reset_at
 *             "charged" adds to charged_turns (cumulative)
 */
export async function adminGrantTurns(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  amount: number,
  grant_type: "subscription" | "charged"
) {
  // Get existing balance
  const { data: existing } = await client
    .from("nv2_turn_balance")
    .select("id, subscription_turns, charged_turns")
    .eq("auth_user_id", auth_user_id)
    .maybeSingle();

  if (existing) {
    // Update existing row
    const update =
      grant_type === "subscription"
        ? {
            subscription_turns: amount,
            subscription_reset_at: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }
        : { charged_turns: (existing.charged_turns ?? 0) + amount };

    const { error } = await client
      .from("nv2_turn_balance")
      .update(update)
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    // Insert new row
    const insert =
      grant_type === "subscription"
        ? {
            auth_user_id,
            subscription_turns: amount,
            charged_turns: 0,
            subscription_reset_at: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ).toISOString(),
          }
        : {
            auth_user_id,
            subscription_turns: 0,
            charged_turns: amount,
          };

    const { error } = await client
      .from("nv2_turn_balance")
      .insert(insert);

    if (error) throw error;
  }
}

/**
 * Fetches a single user's full detail for admin:
 *   auth.users (email, created_at) + nv2_profiles + nv2_turn_balance
 *
 * Requires service_role client (adminClient).
 */
export async function adminGetUserDetail(
  client: SupabaseClient<Database>,
  auth_user_id: string
) {
  // auth.users info
  const { data: auth_user_data, error: auth_error } =
    await (client as any).auth.admin.getUserById(auth_user_id);
  if (auth_error) throw auth_error;

  const auth_user = auth_user_data?.user as {
    id: string;
    email?: string;
    created_at: string;
  } | null;

  if (!auth_user) return null;

  const { data: profile } = await client
    .from("nv2_profiles")
    .select("sns_type, sns_id, auth_user_id, display_name, avatar_url, timezone, send_hour, is_active, created_at")
    .eq("auth_user_id", auth_user_id)
    .maybeSingle();

  const { data: balance } = await client
    .from("nv2_turn_balance")
    .select("subscription_turns, charged_turns, subscription_reset_at")
    .eq("auth_user_id", auth_user_id)
    .maybeSingle();

  return {
    auth_user_id: auth_user.id,
    email: auth_user.email ?? null,
    auth_created_at: auth_user.created_at,
    // Profile (may be null if user hasn't connected Discord)
    sns_type: profile?.sns_type ?? null,
    sns_id: profile?.sns_id ?? null,
    display_name: profile?.display_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    timezone: profile?.timezone ?? "Asia/Seoul",
    send_hour: profile?.send_hour ?? 5,
    is_active: profile?.is_active ?? true,
    // Turn balance
    subscription_turns: balance?.subscription_turns ?? 0,
    charged_turns: balance?.charged_turns ?? 0,
    subscription_reset_at: balance?.subscription_reset_at ?? null,
  };
}

/**
 * Updates a user's profile settings (timezone, send_hour, is_active).
 */
export async function adminUpdateUserProfile(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  updates: {
    timezone?: string;
    send_hour?: number;
    is_active?: boolean;
  }
) {
  const { error } = await client
    .from("nv2_profiles")
    .update(updates)
    .eq("auth_user_id", auth_user_id);

  if (error) throw error;
}
