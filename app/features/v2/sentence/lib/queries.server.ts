/**
 * Sentence practice query helpers.
 *
 * Collects example cards (+ matching description cards) from learning stages
 * that precede the sentence_practice stage within the same session.
 *
 * Unlike quiz queries, sentence_practice does NOT span previous sessions —
 * it uses only the current session's learning stages.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import type { SnsType } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SentenceCard {
  /** ID of the learning stage this card belongs to */
  stage_id: string;
  /** The target-language example sentence (used for word-ordering exercise) */
  example_front: string;
  /** Translation of the example sentence (shown during shadowing) */
  example_back: string;
  /** Core meaning / description of the word (shown as hint above word bank) */
  description_back: string;
  /** The word being studied (title card front) */
  word: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Fetches the sentence_practice stage and its parent session context.
 * Mirrors getQuizStageContext() from quiz/lib/queries.server.ts.
 */
export async function getSentenceStageContext(
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
// Card Pool
// ---------------------------------------------------------------------------

/**
 * Collects sentence cards from learning stages in the current session.
 *
 * For each learning stage that precedes the sentence_practice stage,
 * we collect:
 *   - example card  (front = target sentence, back = translation)
 *   - description card (back = meaning hint shown above the word bank)
 *   - title card    (front = the word being studied)
 *
 * A SentenceCard is emitted only when the stage has all three card types.
 * Stages missing an example card are silently skipped.
 */
export async function getSentenceCardPool(
  client: SupabaseClient<Database>,
  product_session_id: string,
  sentence_stage_id: string
): Promise<SentenceCard[]> {
  // ── Step 1: Load all stages in the current session (ascending order) ─────
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

  // ── Step 2: Find the sentence_practice stage's display_order ─────────────
  const sentence_entry = session_stages.find(
    (s) => s.stage_id === sentence_stage_id
  );
  const sentence_display_order = sentence_entry?.display_order ?? 9999;

  // ── Step 3: Collect cards from learning stages before this one ────────────
  const result: SentenceCard[] = [];

  for (const entry of session_stages) {
    // Only process stages that come before the sentence_practice stage
    if (entry.display_order >= sentence_display_order) continue;

    const stage = entry.nv2_stages as any;
    if (!stage || stage.stage_type !== "learning") continue;

    const cards = (stage.nv2_cards ?? []) as any[];
    const active_cards = cards.filter((c: any) => c.is_active);

    // Extract title, description, and example cards
    const title_card = active_cards.find((c: any) => c.card_type === "title");
    const desc_card = active_cards.find(
      (c: any) => c.card_type === "description"
    );
    const example_card = active_cards.find(
      (c: any) => c.card_type === "example"
    );

    // Skip stages that don't have an example card
    if (!example_card) continue;

    const example_data = example_card.card_data as any;
    const desc_data = desc_card?.card_data as any;
    const title_data = title_card?.card_data as any;

    result.push({
      stage_id: stage.id,
      example_front: example_data?.presentation?.front ?? "",
      example_back: example_data?.presentation?.back ?? "",
      description_back: desc_data?.presentation?.back ?? "",
      word: title_data?.presentation?.front ?? "",
    });
  }

  return result;
}
