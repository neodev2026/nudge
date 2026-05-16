/**
 * Hyper-Sync server-side DB queries.
 *
 * Callers should pass a Supabase client appropriate for the operation:
 *   - read public mission/card data: server client OR admin client
 *   - write nv2_hyper_sync_results: admin client (anonymous users have no
 *     auth.uid() so RLS select_own won't match — service_role bypasses RLS)
 *   - write nv2_schedules: admin client
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import type { V2CardData } from "~/features/v2/shared/types";
import {
  parseHyperSyncMessageBody,
  serializeHyperSyncMessageBody,
} from "./message-body";
import { nextMorningAt } from "./session-logic";
import type { CardEntry, FrontBackCard } from "./session-logic";

// ---------------------------------------------------------------------------
// Product + missions
// ---------------------------------------------------------------------------

export async function getHyperSyncProduct(
  client: SupabaseClient<Database>,
  slug: string
) {
  const { data, error } = await client
    .from("nv2_learning_products")
    .select("id, name, slug, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export interface HyperSyncMission {
  id: string;
  sessionNumber: number;
  title: string;
  stageCount: number;
}

/**
 * Returns active sessions for a product with their stage counts.
 * Stage count is computed from the nv2_product_session_stages join, filtered
 * to learning stages only (we don't run hyper-sync on quiz stages).
 */
export async function getHyperSyncMissions(
  client: SupabaseClient<Database>,
  product_id: string
): Promise<HyperSyncMission[]> {
  const { data, error } = await client
    .from("nv2_product_sessions")
    .select(
      `
      id,
      session_number,
      title,
      nv2_product_session_stages (
        stage_id,
        nv2_stages ( id, stage_type, is_active )
      )
    `
    )
    .eq("product_id", product_id)
    .eq("is_active", true)
    .order("session_number", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const stages = (row.nv2_product_session_stages ?? []) as Array<{
      nv2_stages: { id: string; stage_type: string; is_active: boolean } | null;
    }>;
    const stageCount = stages.filter(
      (s) =>
        s.nv2_stages &&
        s.nv2_stages.is_active &&
        s.nv2_stages.stage_type === "learning"
    ).length;
    return {
      id: row.id,
      sessionNumber: row.session_number,
      title: row.title ?? `Session ${row.session_number}`,
      stageCount,
    };
  });
}

/**
 * Returns the next active session (by session_number) after current_number.
 * Used by the [다음 미션] button on the result screen.
 */
export async function getNextHyperSyncMission(
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

  if (error) throw new Error(error.message);
  return data;
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

interface RawCardRow {
  id: string;
  card_type: string;
  display_order: number;
  card_data: V2CardData | null;
  is_active: boolean;
}

function frontBack(row: RawCardRow): FrontBackCard | null {
  const presentation = row.card_data?.presentation;
  const front = presentation?.front;
  const back = presentation?.back;
  if (!front || !back) return null;
  return { id: row.id, front, back };
}

/**
 * Returns CardEntry[] for a session, pairing each title card with its
 * matching example card (by parent stage). Order follows the session's
 * stage display_order; example cards are paired but never become their
 * own entry.
 */
export async function getHyperSyncCards(
  client: SupabaseClient<Database>,
  product_session_id: string
): Promise<CardEntry[]> {
  const { data, error } = await client
    .from("nv2_product_session_stages")
    .select(
      `
      display_order,
      stage_id,
      nv2_stages (
        id,
        stage_type,
        is_active,
        nv2_cards ( id, card_type, display_order, card_data, is_active )
      )
    `
    )
    .eq("product_session_id", product_session_id)
    .order("display_order", { ascending: true });

  if (error) throw new Error(error.message);

  const entries: CardEntry[] = [];

  for (const row of data ?? []) {
    const stage = row.nv2_stages as
      | { id: string; stage_type: string; is_active: boolean; nv2_cards: RawCardRow[] }
      | null;
    if (!stage || !stage.is_active || stage.stage_type !== "learning") continue;

    const active = (stage.nv2_cards ?? []).filter((c) => c.is_active);
    const title = active
      .filter((c) => c.card_type === "title")
      .sort((a, b) => a.display_order - b.display_order)[0];
    const example = active
      .filter((c) => c.card_type === "example")
      .sort((a, b) => a.display_order - b.display_order)[0];

    const titleCard = title ? frontBack(title) : null;
    if (!titleCard) continue;

    const exampleCard = example ? frontBack(example) : null;
    entries.push({ titleCard, exampleCard });
  }

  return entries;
}

/**
 * Loads CardEntry[] for the specific title-card IDs listed in a review
 * schedule. Pairs each title with its sibling example via parent stage.
 */
export async function getHyperSyncCardsByIds(
  client: SupabaseClient<Database>,
  title_card_ids: string[]
): Promise<CardEntry[]> {
  if (title_card_ids.length === 0) return [];

  // Fetch the title cards first to discover their parent stage_ids.
  const { data: titleRows, error: titleErr } = await client
    .from("nv2_cards")
    .select("id, stage_id, card_type, card_data, is_active")
    .in("id", title_card_ids);

  if (titleErr) throw new Error(titleErr.message);

  const stageIds = Array.from(
    new Set((titleRows ?? []).map((r) => r.stage_id).filter((s): s is string => !!s))
  );
  if (stageIds.length === 0) return [];

  const { data: siblingRows, error: sibErr } = await client
    .from("nv2_cards")
    .select("id, stage_id, card_type, card_data, is_active, display_order")
    .in("stage_id", stageIds)
    .eq("is_active", true);

  if (sibErr) throw new Error(sibErr.message);

  const byStage = new Map<string, RawCardRow[]>();
  for (const row of (siblingRows ?? []) as unknown as (RawCardRow & {
    stage_id: string;
  })[]) {
    const arr = byStage.get(row.stage_id) ?? [];
    arr.push(row);
    byStage.set(row.stage_id, arr);
  }

  // Preserve the input order of title_card_ids
  const result: CardEntry[] = [];
  for (const titleId of title_card_ids) {
    const titleRow = (titleRows ?? []).find((r) => r.id === titleId);
    if (!titleRow || !titleRow.is_active || !titleRow.stage_id) continue;

    const titleCard = frontBack(titleRow as unknown as RawCardRow);
    if (!titleCard) continue;

    const siblings = byStage.get(titleRow.stage_id) ?? [];
    const example = siblings
      .filter((c) => c.card_type === "example")
      .sort((a, b) => a.display_order - b.display_order)[0];
    const exampleCard = example ? frontBack(example) : null;

    result.push({ titleCard, exampleCard });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Result persistence
// ---------------------------------------------------------------------------

/**
 * Upsert one card result for one user on one local day.
 *   ON CONFLICT (auth_user_id, card_id, session_date) DO UPDATE
 *     result = EXCLUDED.result,
 *     known_count = nv2_hyper_sync_results.known_count + (EXCLUDED.result = 'known' ? 1 : 0)
 *
 * Implemented via PostgREST upsert with onConflict; known_count increment is
 * handled by reading the existing row first when the verdict is 'known'.
 */
export async function saveHyperSyncResult(
  adminClient: SupabaseClient<Database>,
  params: {
    authUserId: string;
    productId: string;
    sessionId: string;
    cardId: string;
    result: "known" | "unknown";
    sessionDate: string;
  }
) {
  // Read existing row for known_count math.
  const { data: existing } = await adminClient
    .from("nv2_hyper_sync_results")
    .select("id, known_count")
    .eq("auth_user_id", params.authUserId)
    .eq("card_id", params.cardId)
    .eq("session_date", params.sessionDate)
    .maybeSingle();

  const known_increment = params.result === "known" ? 1 : 0;
  const next_known_count = (existing?.known_count ?? 0) + known_increment;

  const { error } = await adminClient
    .from("nv2_hyper_sync_results")
    .upsert(
      {
        auth_user_id: params.authUserId,
        product_id: params.productId,
        session_id: params.sessionId,
        card_id: params.cardId,
        result: params.result,
        known_count: next_known_count,
        session_date: params.sessionDate,
      },
      { onConflict: "auth_user_id,card_id,session_date" }
    );

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Review schedule
// ---------------------------------------------------------------------------

/**
 * Enqueues a hyper_sync_review schedule row in nv2_schedules.
 * No-op for anonymous users (auth_user_id starts with 'anon:').
 * Dedups card_ids already pending for the same user.
 *
 * Returns the inserted schedule_id, or null if skipped/deduped.
 */
export async function enqueueHyperSyncReview(
  adminClient: SupabaseClient<Database>,
  params: {
    authUserId: string;
    productSlug: string;
    sourceSessionId: string;
    unknownCardIds: string[];
    timezone: string;
    origin: string;
  }
): Promise<{ scheduleId: bigint | null }> {
  if (params.authUserId.startsWith("anon:")) return { scheduleId: null };
  if (params.unknownCardIds.length === 0) return { scheduleId: null };

  // 1. Collect already-pending card_ids for this user.
  const { data: pending } = await adminClient
    .from("nv2_schedules")
    .select("schedule_id, message_body")
    .eq("auth_user_id", params.authUserId)
    .eq("schedule_type", "hyper_sync_review")
    .eq("status", "pending");

  const alreadyPending = new Set<string>();
  for (const row of pending ?? []) {
    const parsed = parseHyperSyncMessageBody(row.message_body);
    if (parsed) {
      for (const id of parsed.cardIds) alreadyPending.add(id);
    }
  }

  // 2. Filter out cards already scheduled.
  const newCardIds = params.unknownCardIds.filter((id) => !alreadyPending.has(id));
  if (newCardIds.length === 0) return { scheduleId: null };

  // 3. Insert with a placeholder delivery_url; we need the schedule_id to build the real one.
  const scheduledAt = nextMorningAt(params.timezone || "Asia/Seoul", 9);
  const messageBody = serializeHyperSyncMessageBody({
    productSlug: params.productSlug,
    sourceSessionId: params.sourceSessionId,
    cardIds: newCardIds,
    totalUnknown: newCardIds.length,
  });

  const { data: inserted, error: insertErr } = await adminClient
    .from("nv2_schedules")
    .insert({
      auth_user_id: params.authUserId,
      schedule_type: "hyper_sync_review",
      delivery_url: "pending",
      message_body: messageBody,
      scheduled_at: scheduledAt,
      status: "pending",
    })
    .select("schedule_id")
    .single();

  if (insertErr) throw new Error(insertErr.message);

  const scheduleId = inserted.schedule_id as unknown as bigint;
  const deliveryUrl = `${params.origin}/hyper-sync/review/${scheduleId}`;

  const { error: updateErr } = await adminClient
    .from("nv2_schedules")
    .update({ delivery_url: deliveryUrl })
    .eq("schedule_id", scheduleId as unknown as number);

  if (updateErr) throw new Error(updateErr.message);

  return { scheduleId };
}

/**
 * Loads a review schedule for the review page. Returns null if missing or
 * if the requesting user isn't the owner.
 */
export async function getHyperSyncReviewSchedule(
  adminClient: SupabaseClient<Database>,
  schedule_id: string | bigint,
  auth_user_id: string
) {
  const { data, error } = await adminClient
    .from("nv2_schedules")
    .select(
      "schedule_id, auth_user_id, message_body, scheduled_at, sent_at, opened_at, status"
    )
    .eq("schedule_id", schedule_id as unknown as number)
    .eq("schedule_type", "hyper_sync_review")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  if (data.auth_user_id !== auth_user_id) return null;

  return data;
}

/**
 * Stamps opened_at on a review schedule the first time the user lands on
 * the review page. No-op if already set.
 */
export async function markHyperSyncReviewOpened(
  adminClient: SupabaseClient<Database>,
  schedule_id: string | bigint
) {
  const { error } = await adminClient
    .from("nv2_schedules")
    .update({ opened_at: new Date().toISOString() })
    .eq("schedule_id", schedule_id as unknown as number)
    .is("opened_at", null);

  if (error) throw new Error(error.message);
}
