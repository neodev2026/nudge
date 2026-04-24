import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarathonCard {
  id: string;
  card_type: string;
  display_order: number;
  card_data: any;
}

export interface MarathonStage {
  id: string;
  title: string;
  stage_number: number;
  cards: MarathonCard[];
}

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export async function getMarathonProduct(
  client: SupabaseClient<Database>,
  slug: string
) {
  const { data, error } = await client
    .from("nv2_learning_products")
    .select("id, name, slug, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Stages + Cards — all learning stages for a product ordered by stage_number
// ---------------------------------------------------------------------------

export async function getMarathonStages(
  client: SupabaseClient<Database>,
  product_id: string
): Promise<MarathonStage[]> {
  const { data, error } = await client
    .from("nv2_stages")
    .select(
      `
      id, title, stage_number,
      nv2_cards (
        id, card_type, display_order, card_data, is_active
      )
    `
    )
    .eq("learning_product_id", product_id)
    .eq("stage_type", "learning")
    .eq("is_active", true)
    .order("stage_number", { ascending: true })
    .order("display_order", {
      referencedTable: "nv2_cards",
      ascending: true,
    });

  if (error) throw error;

  return (data ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    stage_number: s.stage_number,
    cards: ((s.nv2_cards as (MarathonCard & { is_active?: boolean })[]) ?? []).filter((c) => c.is_active !== false),
  }));
}

// ---------------------------------------------------------------------------
// Subscription check
// ---------------------------------------------------------------------------

export async function checkMarathonSubscription(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  product_id: string
): Promise<boolean> {
  const { data } = await client
    .from("nv2_subscriptions")
    .select("id")
    .eq("auth_user_id", auth_user_id)
    .eq("product_id", product_id)
    .eq("is_active", true)
    .maybeSingle();

  return !!data;
}

// ---------------------------------------------------------------------------
// Run — in_progress run for a user + product
// ---------------------------------------------------------------------------

export async function getMarathonInProgressRun(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  product_id: string
) {
  const { data, error } = await client
    .from("nv2_marathon_runs")
    .select("id, run_number, last_stage_index, started_at")
    .eq("auth_user_id", auth_user_id)
    .eq("product_id", product_id)
    .eq("status", "in_progress")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getMarathonCompletedRunCount(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  product_id: string
): Promise<number> {
  const { count, error } = await client
    .from("nv2_marathon_runs")
    .select("id", { count: "exact", head: true })
    .eq("auth_user_id", auth_user_id)
    .eq("product_id", product_id)
    .eq("status", "completed");

  if (error) throw error;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Result page — all completed runs with their answers
// ---------------------------------------------------------------------------

export async function getMarathonCompletedRuns(
  client: SupabaseClient<Database>,
  auth_user_id: string,
  product_id: string
) {
  const { data, error } = await client
    .from("nv2_marathon_runs")
    .select(
      "id, run_number, score, total_questions, elapsed_seconds, completed_at"
    )
    .eq("auth_user_id", auth_user_id)
    .eq("product_id", product_id)
    .eq("status", "completed")
    .order("run_number", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
