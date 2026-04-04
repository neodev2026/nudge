/**
 * Quiz query helpers.
 *
 * Collects title cards only from learning stages that precede the quiz stage.
 * Each title card provides both front (word) and back (translation) —
 * the quiz pairs word ↔ translation using a single card type.
 *
 * Pool size is determined by QUIZ_CARD_POOL_SIZE[stage_type] in constants.ts.
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
  /** Always "title" — quiz uses only title cards */
  card_type: "title";
  /** German word (displayed in word column or as TTS source) */
  front: string;
  /** Korean translation (displayed in meaning column) */
  back: string;
  logic_key: string; // = stage_id
}

/** Ranking entry for the result screen */
export interface QuizRankEntry {
  sns_id: string;
  score: number;
  completed_at: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Card Pool — title cards only
// ---------------------------------------------------------------------------

/**
 * Collects title cards for a quiz pool.
 *
 * Only title cards are collected — each card provides both the word (front)
 * and its translation (back), which are displayed as separate buttons in the UI.
 *
 * Pool is shuffled so cards appear in random order each time.
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
    .lte("session_number", current_ps.session_number)
    .order("session_number", { ascending: false });

  if (!all_sessions || all_sessions.length === 0) return [];

  // ── Step 3: Walk sessions backwards, collecting title cards ───────────────
  const collected_cards: QuizCard[] = [];
  let learning_stage_count = 0;

  for (const ps of all_sessions) {
    if (learning_stage_count >= pool_size) break;

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
        const quiz_entry = session_stages.find(
          (s) => s.stage_id === quiz_stage_id
        );
        if (quiz_entry && entry.display_order >= quiz_entry.display_order) {
          continue;
        }
      }

      const stage = entry.nv2_stages as any;
      if (!stage || stage.stage_type !== "learning") continue;

      const stage_cards = (stage.nv2_cards ?? []) as any[];

      // Collect title card only
      const title_card = stage_cards.find(
        (c: any) => c.is_active && c.card_type === "title"
      );

      if (!title_card) continue;

      const card_data = title_card.card_data as any;
      collected_cards.unshift({
        card_id: title_card.id,
        stage_id: stage.id,
        card_type: "title",
        front: card_data?.presentation?.front ?? "",
        back: card_data?.presentation?.back ?? "",
        logic_key: card_data?.meta?.logic_key ?? stage.id,
      });
      learning_stage_count++;
    }
  }

  // Shuffle pool for random card order
  return shuffleArray(collected_cards);
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Fetches top quiz scores for a given quiz stage.
 * Returns top 10 results ordered by score descending.
 * Score is read from result_snapshot.score (new field).
 * Falls back to matched_pairs_count * 10 for legacy records.
 */
export async function getQuizRanking(
  client: SupabaseClient<Database>,
  quiz_stage_id: string
): Promise<QuizRankEntry[]> {
  const { data, error } = await client
    .from("nv2_quiz_results")
    .select("sns_id, matched_pairs_count, result_snapshot, completed_at")
    .contains("covered_stage_ids", [quiz_stage_id])
    .order("matched_pairs_count", { ascending: false })
    .limit(10);

  if (error || !data) return [];

  return data.map((row) => {
    const snapshot = row.result_snapshot as any;
    const score = snapshot?.score ?? (row.matched_pairs_count * 10);
    return {
      sns_id: row.sns_id,
      score,
      completed_at: row.completed_at?.toString() ?? "",
    };
  });
}

// ---------------------------------------------------------------------------
// Save Result
// ---------------------------------------------------------------------------

export async function saveQuizResult(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string,
  stage_id: string,
  stage_type: string,
  matched_pairs_count: number,
  score: number,
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
      score,
      duration_seconds,
      completed_at: new Date().toISOString(),
    },
    started_at: new Date(Date.now() - duration_seconds * 1000).toISOString(),
    completed_at: new Date().toISOString(),
  });

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Quiz5 Types
// ---------------------------------------------------------------------------

export interface Quiz5Card {
  stage_id: string;
  word: string;           // title.front
  translation: string;    // title.back
  description: string;    // description.back
  example_front: string;  // example.front (target sentence)
  example_back: string;   // example.back (translation)
}

// ---------------------------------------------------------------------------
// Quiz5 Card Pool
// ---------------------------------------------------------------------------

/**
 * Collects title + description + example cards from learning stages
 * that precede the quiz_5 stage within the same session.
 *
 * Returns one Quiz5Card per learning stage (5 cards for quiz_5).
 * Stages missing any card type are silently skipped.
 */
export async function getQuiz5CardPool(
  client: SupabaseClient<Database>,
  product_session_id: string,
  quiz_stage_id: string
): Promise<Quiz5Card[]> {
  // Load all stages in the current session (ascending order)
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
    .eq("product_session_id", product_session_id)
    .order("display_order", { ascending: true });

  if (!session_stages || session_stages.length === 0) return [];

  // Find the quiz stage display_order to only include stages before it
  const quiz_entry = session_stages.find((s) => s.stage_id === quiz_stage_id);
  const quiz_display_order = quiz_entry?.display_order ?? 9999;

  const result: Quiz5Card[] = [];

  for (const entry of session_stages) {
    if (entry.display_order >= quiz_display_order) continue;

    const stage = entry.nv2_stages as any;
    if (!stage || stage.stage_type !== "learning") continue;

    const cards = (stage.nv2_cards ?? []) as any[];
    const active = cards.filter((c: any) => c.is_active);

    const title_card   = active.find((c: any) => c.card_type === "title");
    const desc_card    = active.find((c: any) => c.card_type === "description");
    const example_card = active.find((c: any) => c.card_type === "example");

    // All three card types required
    if (!title_card || !desc_card || !example_card) continue;

    const t = title_card.card_data as any;
    const d = desc_card.card_data as any;
    const e = example_card.card_data as any;

    result.push({
      stage_id:      stage.id,
      word:          t?.presentation?.front ?? "",
      translation:   t?.presentation?.back  ?? "",
      description:   d?.presentation?.back  ?? "",
      example_front: e?.presentation?.front ?? "",
      example_back:  e?.presentation?.back  ?? "",
    });
  }

  return result;
}
