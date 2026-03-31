/**
 * Quiz query helpers.
 *
 * Collects title and description cards from learning stages
 * that precede the quiz stage, looking back across sessions if needed.
 *
 * Pool size is determined by QUIZ_CARD_POOL_SIZE[stage_type] in constants.ts.
 * e.g. quiz_5 → 5 stages, quiz_10 → 10 stages (spans previous session).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import { QUIZ_CARD_POOL_SIZE } from "~/features/v2/shared/constants";
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
 */
export async function getQuizStageContext(
  client: SupabaseClient<Database>,
  stage_id: string,
  session_id: string
) {
  const { data: stage, error: stage_error } = await client
    .from("nv2_stages")
    .select("id, stage_type, stage_number, title, learning_product_id")
    .eq("id", stage_id)
    .maybeSingle();

  if (stage_error) throw stage_error;
  if (!stage) return null;

  const { data: session } = await client
    .from("nv2_sessions")
    .select("session_id, product_session_id, sns_type, sns_id, session_kind")
    .eq("session_id", session_id)
    .maybeSingle();

  if (!session) return null;

  return { stage, session };
}

/**
 * Collects title and description cards for a quiz pool.
 *
 * Strategy:
 * 1. Load all product_sessions for this product, ordered by session_number DESC
 * 2. Walk backwards from the current session collecting learning stages
 * 3. Stop once we have `pool_size` learning stages worth of cards
 *
 * This allows quiz_10 to span the previous session, quiz_50 to span
 * multiple sessions, etc. — all configurable via QUIZ_CARD_POOL_SIZE.
 */
export async function getQuizCardPool(
  client: SupabaseClient<Database>,
  product_session_id: string,
  quiz_stage_id: string,
  quiz_stage_type: string
): Promise<QuizCard[]> {
  const pool_size = QUIZ_CARD_POOL_SIZE[quiz_stage_type] ?? 5;

  // ── Step 1: Get current product_session info ──────────────────────────────
  const { data: current_ps } = await client
    .from("nv2_product_sessions")
    .select("id, product_id, session_number")
    .eq("id", product_session_id)
    .maybeSingle();

  if (!current_ps) return [];

  // ── Step 2: Load all product_sessions for this product (newest first) ─────
  const { data: all_sessions } = await client
    .from("nv2_product_sessions")
    .select("id, session_number")
    .eq("product_id", current_ps.product_id)
    .eq("is_active", true)
    .lte("session_number", current_ps.session_number) // current and older
    .order("session_number", { ascending: false });

  if (!all_sessions || all_sessions.length === 0) return [];

  // ── Step 3: Walk sessions backwards, collecting learning stages ───────────
  const collected_cards: QuizCard[] = [];
  let learning_stage_count = 0;

  for (const ps of all_sessions) {
    if (learning_stage_count >= pool_size) break;

    // Load all stages in this session ordered by display_order DESC
    // (newest stages first within session)
    const { data: session_stages } = await client
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
      .eq("product_session_id", ps.id)
      .order("display_order", { ascending: false });

    if (!session_stages) continue;

    for (const entry of session_stages) {
      if (learning_stage_count >= pool_size) break;

      // For the current session: only collect stages BEFORE the quiz stage
      if (ps.id === product_session_id) {
        // We need to find the quiz stage's display_order first
        const quiz_entry = session_stages.find(
          (s) => s.stage_id === quiz_stage_id
        );
        if (quiz_entry && entry.display_order >= quiz_entry.display_order) {
          continue; // Skip quiz stage and anything after it
        }
      }

      const stage = entry.nv2_stages as any;
      if (!stage || stage.stage_type !== "learning") continue;

      // Collect title + description cards from this stage
      const stage_cards = (stage.nv2_cards ?? []) as any[];
      const stage_quiz_cards: QuizCard[] = [];

      for (const card of stage_cards) {
        if (!card.is_active) continue;
        if (card.card_type !== "title" && card.card_type !== "description") continue;

        const card_data = card.card_data as any;
        stage_quiz_cards.push({
          card_id: card.id,
          stage_id: stage.id,
          card_type: card.card_type as "title" | "description",
          front: card_data?.presentation?.front ?? "",
          back: card_data?.presentation?.back ?? "",
          logic_key: card_data?.meta?.logic_key ?? stage.id,
        });
      }

      if (stage_quiz_cards.length > 0) {
        // Prepend — we're walking backwards, so prepend to keep chronological order
        collected_cards.unshift(...stage_quiz_cards);
        learning_stage_count++;
      }
    }
  }

  return collected_cards;
}

/**
 * Saves quiz result to nv2_quiz_results.
 * quiz_type is derived from stage_type:
 *   quiz_10   → quiz_10
 *   otherwise → quiz_5 (enum only has quiz_5 and quiz_10)
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
  const quiz_type = stage_type === "quiz_10" ? "quiz_10" : "quiz_5";

  const { error } = await client.from("nv2_quiz_results").insert({
    sns_type,
    sns_id,
    quiz_type,
    trigger_at_count: 0,
    covered_stage_ids,
    matched_pairs_count,
    result_snapshot: {
      quiz_type,
      stage_type,
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
