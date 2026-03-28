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
    .upsert(product)
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
    .upsert(stage)
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
    .upsert(card)
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
