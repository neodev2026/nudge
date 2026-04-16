/**
 * Dictation stage query helpers.
 *
 * Collects example cards from learning stages in the current session
 * to use as dictation prompts (user hears TTS and types what they hear).
 *
 * Reuses the same card-pool pattern as sentence/lib/queries.server.ts.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DictationItem {
  stage_id: string;
  sentence: string;         // target-language example sentence (TTS source)
  translation: string;      // translation shown after answer
  word: string;             // the word being studied
  tts_lang: string;         // BCP-47 language tag
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export async function getDictationStageContext(
  client: SupabaseClient<Database>,
  stage_id: string,
  session_id: string
) {
  const { data: stage, error } = await client
    .from("nv2_stages")
    .select("id, stage_type, stage_number, title, learning_product_id")
    .eq("id", stage_id)
    .maybeSingle();

  if (error) throw error;
  if (!stage) return null;

  const { data: session } = await client
    .from("nv2_sessions")
    .select("session_id, product_session_id, auth_user_id")
    .eq("session_id", session_id)
    .maybeSingle();

  if (!session) return null;

  return { stage, session };
}

// ---------------------------------------------------------------------------
// Card Pool
// ---------------------------------------------------------------------------

const LOCALE_MAP: Record<string, string> = {
  de: "de-DE", en: "en-US", ja: "ja-JP",
  ko: "ko-KR", fr: "fr-FR", es: "es-ES",
};

/**
 * Collects dictation items from learning stages that precede the dictation
 * stage within the same session. Each item is one example sentence.
 */
export async function getDictationCardPool(
  client: SupabaseClient<Database>,
  product_session_id: string,
  dictation_stage_id: string
): Promise<DictationItem[]> {
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

  const dictation_entry = session_stages.find(
    (s) => s.stage_id === dictation_stage_id
  );
  const dictation_order = dictation_entry?.display_order ?? 9999;

  const result: DictationItem[] = [];

  for (const entry of session_stages) {
    if (entry.display_order >= dictation_order) continue;

    const stage = entry.nv2_stages as any;
    if (!stage || stage.stage_type !== "learning") continue;

    const cards = (stage.nv2_cards ?? []) as any[];
    const active = cards.filter((c: any) => c.is_active);

    const title_card = active.find((c: any) => c.card_type === "title");
    const example_card = active.find((c: any) => c.card_type === "example");

    if (!example_card) continue;

    const ex = example_card.card_data as any;
    const ti = title_card?.card_data as any;
    const locale = ti?.meta?.target_locale ?? "de";

    result.push({
      stage_id: stage.id,
      sentence: ex?.presentation?.front ?? "",
      translation: ex?.presentation?.back ?? "",
      word: ti?.presentation?.front ?? "",
      tts_lang: LOCALE_MAP[locale] ?? "de-DE",
    });
  }

  return result;
}
