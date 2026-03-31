/**
 * Quiz query helpers.
 *
 * Collects title and description cards from learning stages
 * that precede the quiz stage within the same session.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import type { SnsType } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuizCard {
  card_id: string;
  stage_id: string;
  card_type: "title" | "description";
  front: string;
  back: string;
  logic_key: string; // = stage_id — used to pair title ↔ description
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches the quiz stage and its parent session context.
 * Returns stage_type (to determine timer), session_id, and product_session_id.
 */
export async function getQuizStageContext(
  client: SupabaseClient<Database>,
  stage_id: string,
  session_id: string
) {
  // Load quiz stage info
  const { data: stage, error: stage_error } = await client
    .from("nv2_stages")
    .select("id, stage_type, stage_number, title, learning_product_id")
    .eq("id", stage_id)
    .maybeSingle();

  if (stage_error) throw stage_error;
  if (!stage) return null;

  // Load session to get product_session_id
  const { data: session } = await client
    .from("nv2_sessions")
    .select("session_id, product_session_id, sns_type, sns_id, session_kind")
    .eq("session_id", session_id)
    .maybeSingle();

  if (!session) return null;

  return { stage, session };
}

/**
 * Collects title and description cards from learning stages
 * that precede the quiz stage in the same product_session.
 *
 * Returns pairs of (title, description) grouped by logic_key (= stage_id).
 * Quiz pool is built from these pairs.
 */
export async function getQuizCardPool(
  client: SupabaseClient<Database>,
  product_session_id: string,
  quiz_stage_id: string
): Promise<QuizCard[]> {
  // Load all stages in this session ordered by display_order
  const { data: session_stages, error } = await client
    .from("nv2_product_session_stages")
    .select(`
      stage_id,
      display_order,
      nv2_stages!inner (
        id,
        stage_type,
        nv2_cards (
          id,
          card_type,
          card_data,
          display_order,
          is_active
        )
      )
    `)
    .eq("product_session_id", product_session_id)
    .order("display_order", { ascending: true });

  if (error) throw error;
  if (!session_stages) return [];

  // Find the display_order of the quiz stage
  const quiz_entry = session_stages.find((s) => s.stage_id === quiz_stage_id);
  if (!quiz_entry) return [];

  const quiz_display_order = quiz_entry.display_order;

  // Collect cards from learning stages BEFORE the quiz stage
  const cards: QuizCard[] = [];

  for (const entry of session_stages) {
    if (entry.display_order >= quiz_display_order) continue; // Skip quiz and later stages

    const stage = entry.nv2_stages as any;
    if (!stage || stage.stage_type !== "learning") continue;

    const stage_cards = (stage.nv2_cards ?? []) as any[];

    for (const card of stage_cards) {
      if (!card.is_active) continue;
      if (card.card_type !== "title" && card.card_type !== "description") continue;

      const card_data = card.card_data as any;
      cards.push({
        card_id: card.id,
        stage_id: stage.id,
        card_type: card.card_type as "title" | "description",
        front: card_data?.presentation?.front ?? "",
        back: card_data?.presentation?.back ?? "",
        logic_key: card_data?.meta?.logic_key ?? stage.id,
      });
    }
  }

  return cards;
}

/**
 * Saves quiz result to nv2_quiz_results.
 * Called by POST /api/v2/quiz/:stageId/result.
 *
 * quiz_type is derived from stage_type:
 *   quiz_5    → quiz_5
 *   quiz_10   → quiz_10
 *   quiz_daily / quiz_final → quiz_5 (fallback)
 */
export async function saveQuizResult(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string,
  stage_id: string,
  stage_type: string,
  matched_pairs_count: number,
  covered_stage_ids: string[],
  duration_seconds: number
) {
  // Map stage_type to nv2_quiz_type enum value
  const quiz_type =
    stage_type === "quiz_10" ? "quiz_10" : "quiz_5";

  const { error } = await client.from("nv2_quiz_results").insert({
    sns_type,
    sns_id,
    quiz_type,
    trigger_at_count: 0,
    covered_stage_ids,
    matched_pairs_count,
    result_snapshot: {
      quiz_type,
      covered_stage_ids,
      matched_pairs: matched_pairs_count,
      duration_seconds,
      completed_at: new Date().toISOString(),
    },
    started_at: new Date(Date.now() - duration_seconds * 1000).toISOString(),
    completed_at: new Date().toISOString(),
  });

  if (error) throw error;
}
