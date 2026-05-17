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
import { REVIEW_INTERVALS_DAYS } from "~/features/v2/shared/constants";
import {
  parseHyperSyncMessageBody,
  serializeHyperSyncMessageBody,
} from "./message-body";
import { nextMorningAt, nextMorningInDays } from "./session-logic";
import type { CardEntry, FrontBackCard } from "./session-logic";

// ---------------------------------------------------------------------------
// SRS interval calculation
// ---------------------------------------------------------------------------

/**
 * Returns the interval in days for a given review round, applying the
 * Nudge "halve if retry_count >= 3" rule. Floor of 1 day so a halved box 1
 * doesn't collapse to same-day delivery (which conflicts with the "next
 * morning at 09:00" delivery model).
 */
export function intervalDaysForRound(
  round: number,
  retryCount: number
): number {
  const baseDays = REVIEW_INTERVALS_DAYS[round] ?? 1;
  if (retryCount >= 3) {
    return Math.max(1, Math.round(baseDays / 2));
  }
  return baseDays;
}

// review_status enum values (kept in sync with REVIEW_STATUSES constant).
const STATUS_NONE = "none" as const;
const STATUS_R1 = "r1_pending" as const;
const STATUS_R2 = "r2_pending" as const;
const STATUS_R3 = "r3_pending" as const;
const STATUS_R4 = "r4_pending" as const;
const STATUS_MASTERED = "mastered" as const;

type ReviewStatus =
  | typeof STATUS_NONE
  | typeof STATUS_R1
  | typeof STATUS_R2
  | typeof STATUS_R3
  | typeof STATUS_R4
  | typeof STATUS_MASTERED;

function statusForRound(round: 1 | 2 | 3 | 4): ReviewStatus {
  return ({ 1: STATUS_R1, 2: STATUS_R2, 3: STATUS_R3, 4: STATUS_R4 } as const)[round];
}

function nextRoundOnPass(round: 1 | 2 | 3 | 4): 2 | 3 | 4 | "mastered" {
  return round === 4 ? "mastered" : ((round + 1) as 2 | 3 | 4);
}

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
    entries.push({ stageId: stage.id, titleCard, exampleCard });
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

    result.push({ stageId: titleRow.stage_id, titleCard, exampleCard });
  }

  return result;
}

// ---------------------------------------------------------------------------
// SRS progress (nv2_stage_progress)
//
// Hyper-Sync reuses the existing per-stage progress table to track
// box level + retry_count + next review time. Same columns Nudge uses,
// just driven by hyper-sync's session/review flows instead of Nudge
// session completion.
// ---------------------------------------------------------------------------

export interface StageProgressRow {
  stage_id: string;
  review_status: ReviewStatus;
  review_round: number | null;
  retry_count: number;
  last_review_completed_at: string | null;
  completed_at: string | null;
}

/** Bulk-reads progress rows for a set of (user, stage_id) pairs. */
export async function getStageProgressByStageIds(
  adminClient: SupabaseClient<Database>,
  authUserId: string,
  stageIds: string[]
): Promise<Map<string, StageProgressRow>> {
  const result = new Map<string, StageProgressRow>();
  if (stageIds.length === 0) return result;

  const { data, error } = await adminClient
    .from("nv2_stage_progress")
    .select(
      "stage_id, review_status, review_round, retry_count, last_review_completed_at, completed_at"
    )
    .eq("auth_user_id", authUserId)
    .in("stage_id", stageIds);

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as StageProgressRow[]) {
    result.set(row.stage_id, row);
  }
  return result;
}

/** Resolves title card_ids to their parent stage_ids. */
export async function cardIdsToStageIds(
  adminClient: SupabaseClient<Database>,
  cardIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (cardIds.length === 0) return result;

  const { data, error } = await adminClient
    .from("nv2_cards")
    .select("id, stage_id")
    .in("id", cardIds);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    if (row.stage_id) result.set(row.id, row.stage_id);
  }
  return result;
}

/**
 * Cancels all pending hyper_sync_review schedules whose message_body refers
 * to any of the given title card_ids. Used by the SRS "refresh on re-failure"
 * rule (SRS-2): when a stage that's already in pending SRS review is failed
 * again, the old schedule is voided so the new shorter-interval schedule
 * doesn't collide.
 *
 * Implementation note: we mark cancelled rows as status='failed' with a
 * marker error_message rather than deleting, so the history stays auditable.
 */
export async function cancelPendingSchedulesForCards(
  adminClient: SupabaseClient<Database>,
  authUserId: string,
  cardIdsToCancel: string[]
): Promise<number> {
  if (cardIdsToCancel.length === 0) return 0;

  // Read pending hyper_sync_review schedules for this user.
  const { data: pending, error } = await adminClient
    .from("nv2_schedules")
    .select("schedule_id, message_body")
    .eq("auth_user_id", authUserId)
    .eq("schedule_type", "hyper_sync_review")
    .eq("status", "pending");

  if (error) throw new Error(error.message);

  const cancelSet = new Set(cardIdsToCancel);
  const toCancel: bigint[] = [];

  for (const row of pending ?? []) {
    const parsed = parseHyperSyncMessageBody(row.message_body);
    if (!parsed) continue;
    if (parsed.cardIds.some((id) => cancelSet.has(id))) {
      toCancel.push(row.schedule_id as unknown as bigint);
    }
  }

  if (toCancel.length === 0) return 0;

  const { error: updateErr } = await adminClient
    .from("nv2_schedules")
    .update({
      status: "failed",
      error_message: "superseded_by_srs_refresh",
    })
    .in(
      "schedule_id",
      toCancel.map((id) => id as unknown as number)
    );

  if (updateErr) throw new Error(updateErr.message);
  return toCancel.length;
}

// ---------------------------------------------------------------------------
// SRS state machine — applied at session / review completion
// ---------------------------------------------------------------------------

/**
 * Verdict from a single session card encounter (one row per stage shown in
 * a mission).
 *
 * known: user clicked [기억함] at step 1 (strict pass per SRS-1)
 * unknown: user clicked [기억못함] OR exhausted the 5-step retry
 */
export interface SessionStageOutcome {
  stageId: string;
  cardId: string; // title card id, kept for results table key
  verdict: "known" | "unknown";
}

/**
 * Verdict from a single review card encounter on /hyper-sync/review.
 *
 * passed: user clicked [기억함] at step 1 (strict pass per SRS-1)
 * failed: anything else (later-step pass OR exhausted)
 */
export interface ReviewStageOutcome {
  stageId: string;
  cardId: string;
  passed: boolean;
}

interface ApplyOutcomesContext {
  authUserId: string;
  productSlug: string;
  sourceSessionId: string;
  timezone: string;
  origin: string;
}

interface ScheduleInsertPlan {
  cardId: string;
  round: 1 | 2 | 3 | 4;
  scheduledAt: string;
}

/**
 * Builds the delivery_url after insert (PK-dependent). Used by INSERT helpers
 * below.
 */
function deliveryUrlFor(origin: string, scheduleId: bigint | string): string {
  return `${origin}/hyper-sync/review/${scheduleId}`;
}

async function insertReviewSchedule(
  adminClient: SupabaseClient<Database>,
  ctx: ApplyOutcomesContext,
  plan: ScheduleInsertPlan
): Promise<bigint> {
  const messageBody = serializeHyperSyncMessageBody({
    productSlug: ctx.productSlug,
    sourceSessionId: ctx.sourceSessionId,
    cardIds: [plan.cardId],
    totalUnknown: 1,
  });

  const { data, error } = await adminClient
    .from("nv2_schedules")
    .insert({
      auth_user_id: ctx.authUserId,
      schedule_type: "hyper_sync_review",
      delivery_url: "pending",
      message_body: messageBody,
      scheduled_at: plan.scheduledAt,
      review_round: plan.round,
      status: "pending",
    })
    .select("schedule_id")
    .single();

  if (error) throw new Error(error.message);

  const scheduleId = data.schedule_id as unknown as bigint;
  const { error: updErr } = await adminClient
    .from("nv2_schedules")
    .update({ delivery_url: deliveryUrlFor(ctx.origin, scheduleId.toString()) })
    .eq("schedule_id", scheduleId as unknown as number);
  if (updErr) throw new Error(updErr.message);

  return scheduleId;
}

async function upsertProgress(
  adminClient: SupabaseClient<Database>,
  authUserId: string,
  stageId: string,
  patch: {
    review_status: ReviewStatus;
    review_round: number | null;
    retry_count: number;
    last_review_completed_at?: string | null;
    completed_at?: string | null;
    next_review_at?: string | null;
  }
) {
  const existing = await adminClient
    .from("nv2_stage_progress")
    .select("progress_id, completed_at")
    .eq("auth_user_id", authUserId)
    .eq("stage_id", stageId)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);

  if (existing.data) {
    const { error } = await adminClient
      .from("nv2_stage_progress")
      .update({
        review_status: patch.review_status,
        review_round: patch.review_round,
        retry_count: patch.retry_count,
        next_review_at: patch.next_review_at ?? null,
        last_review_completed_at:
          patch.last_review_completed_at ?? undefined,
        // completed_at is immutable once set (first encounter timestamp).
        completed_at: existing.data.completed_at ?? patch.completed_at ?? null,
      })
      .eq("progress_id", existing.data.progress_id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await adminClient.from("nv2_stage_progress").insert({
      auth_user_id: authUserId,
      stage_id: stageId,
      review_status: patch.review_status,
      review_round: patch.review_round,
      retry_count: patch.retry_count,
      next_review_at: patch.next_review_at ?? null,
      last_review_completed_at: patch.last_review_completed_at ?? null,
      completed_at: patch.completed_at ?? new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
}

export interface ApplyOutcomesSummary {
  newR1: number;        // first encounter unknown
  newR2: number;        // first encounter known
  refreshed: number;    // pending stage forgotten again → demoted r1
  demotedFromMastered: number;
  promoted: number;     // review pass → next round
  mastered: number;     // review pass on r4
  unchanged: number;    // known on pending stage (no SRS state change)
  scheduleIds: string[];
}

/**
 * Applies session verdicts to SRS state for a logged-in user.
 *
 * For each stage outcome:
 *   - none + known        → r2_pending, schedule +3d
 *   - none + unknown      → r1_pending, schedule +1d, retry_count=1
 *   - r{1..4} + known     → no-op (existing schedule stands)
 *   - r{1..4} + unknown   → refresh: cancel old, r1_pending, schedule +1d, retry_count++
 *   - mastered + known    → no-op (verdict only logged elsewhere)
 *   - mastered + unknown  → r1_pending, schedule +1d, retry_count++ (re-enters SRS)
 *
 * Anonymous users should not call this function — skip at the action layer.
 */
export async function applyHyperSyncSessionOutcomes(
  adminClient: SupabaseClient<Database>,
  ctx: ApplyOutcomesContext,
  outcomes: SessionStageOutcome[]
): Promise<ApplyOutcomesSummary> {
  const summary: ApplyOutcomesSummary = {
    newR1: 0,
    newR2: 0,
    refreshed: 0,
    demotedFromMastered: 0,
    promoted: 0,
    mastered: 0,
    unchanged: 0,
    scheduleIds: [],
  };
  if (outcomes.length === 0) return summary;

  const stageIds = outcomes.map((o) => o.stageId);
  const progressMap = await getStageProgressByStageIds(
    adminClient,
    ctx.authUserId,
    stageIds
  );

  // Cards needing schedule cancellation (refresh / mastered re-entry).
  const cardsToCancel: string[] = [];
  for (const o of outcomes) {
    if (o.verdict !== "unknown") continue;
    const prev = progressMap.get(o.stageId);
    if (!prev) continue;
    if (
      prev.review_status === STATUS_R1 ||
      prev.review_status === STATUS_R2 ||
      prev.review_status === STATUS_R3 ||
      prev.review_status === STATUS_R4
    ) {
      cardsToCancel.push(o.cardId);
    }
    // mastered: no pending schedule to cancel.
  }

  if (cardsToCancel.length > 0) {
    await cancelPendingSchedulesForCards(
      adminClient,
      ctx.authUserId,
      cardsToCancel
    );
  }

  // Apply each outcome.
  for (const o of outcomes) {
    const prev = progressMap.get(o.stageId);
    const prevStatus = prev?.review_status ?? STATUS_NONE;
    const prevRetry = prev?.retry_count ?? 0;

    if (o.verdict === "known") {
      if (prevStatus === STATUS_NONE) {
        // First encounter, known → start at r2_pending (+3 days).
        const days = intervalDaysForRound(2, prevRetry);
        const scheduledAt = nextMorningInDays(ctx.timezone, 9, days);
        const sid = await insertReviewSchedule(adminClient, ctx, {
          cardId: o.cardId,
          round: 2,
          scheduledAt,
        });
        await upsertProgress(adminClient, ctx.authUserId, o.stageId, {
          review_status: STATUS_R2,
          review_round: 2,
          retry_count: prevRetry,
          next_review_at: scheduledAt,
        });
        summary.newR2++;
        summary.scheduleIds.push(sid.toString());
      } else {
        // Already pending or mastered — known is a no-op for SRS state.
        summary.unchanged++;
      }
      continue;
    }

    // o.verdict === "unknown"
    if (prevStatus === STATUS_NONE) {
      const newRetry = 1;
      const days = intervalDaysForRound(1, newRetry);
      const scheduledAt = nextMorningInDays(ctx.timezone, 9, days);
      const sid = await insertReviewSchedule(adminClient, ctx, {
        cardId: o.cardId,
        round: 1,
        scheduledAt,
      });
      await upsertProgress(adminClient, ctx.authUserId, o.stageId, {
        review_status: STATUS_R1,
        review_round: 1,
        retry_count: newRetry,
        next_review_at: scheduledAt,
      });
      summary.newR1++;
      summary.scheduleIds.push(sid.toString());
    } else if (prevStatus === STATUS_MASTERED) {
      const newRetry = prevRetry + 1;
      const days = intervalDaysForRound(1, newRetry);
      const scheduledAt = nextMorningInDays(ctx.timezone, 9, days);
      const sid = await insertReviewSchedule(adminClient, ctx, {
        cardId: o.cardId,
        round: 1,
        scheduledAt,
      });
      await upsertProgress(adminClient, ctx.authUserId, o.stageId, {
        review_status: STATUS_R1,
        review_round: 1,
        retry_count: newRetry,
        next_review_at: scheduledAt,
      });
      summary.demotedFromMastered++;
      summary.scheduleIds.push(sid.toString());
    } else {
      // r1~r4 pending — refresh.
      const newRetry = prevRetry + 1;
      const days = intervalDaysForRound(1, newRetry);
      const scheduledAt = nextMorningInDays(ctx.timezone, 9, days);
      const sid = await insertReviewSchedule(adminClient, ctx, {
        cardId: o.cardId,
        round: 1,
        scheduledAt,
      });
      await upsertProgress(adminClient, ctx.authUserId, o.stageId, {
        review_status: STATUS_R1,
        review_round: 1,
        retry_count: newRetry,
        next_review_at: scheduledAt,
      });
      summary.refreshed++;
      summary.scheduleIds.push(sid.toString());
    }
  }

  return summary;
}

/**
 * Applies review verdicts (from /hyper-sync/review completion) to SRS state.
 *
 *   r{N} + passed (step 1 only) → r{N+1}_pending, schedule +interval(N+1)
 *                                  N=4 → mastered (no schedule)
 *   r{N} + failed                → r1_pending, retry_count++, schedule +1d
 *
 * The current pending schedule's row that hosted this review has already
 * been marked sent by dispatch; we don't need to cancel anything.
 */
export async function applyHyperSyncReviewOutcomes(
  adminClient: SupabaseClient<Database>,
  ctx: ApplyOutcomesContext,
  outcomes: ReviewStageOutcome[]
): Promise<ApplyOutcomesSummary> {
  const summary: ApplyOutcomesSummary = {
    newR1: 0,
    newR2: 0,
    refreshed: 0,
    demotedFromMastered: 0,
    promoted: 0,
    mastered: 0,
    unchanged: 0,
    scheduleIds: [],
  };
  if (outcomes.length === 0) return summary;

  const stageIds = outcomes.map((o) => o.stageId);
  const progressMap = await getStageProgressByStageIds(
    adminClient,
    ctx.authUserId,
    stageIds
  );

  const now = new Date().toISOString();

  for (const o of outcomes) {
    const prev = progressMap.get(o.stageId);
    const prevStatus = prev?.review_status ?? STATUS_R1;
    const prevRetry = prev?.retry_count ?? 0;
    const prevRound =
      prevStatus === STATUS_R1
        ? 1
        : prevStatus === STATUS_R2
        ? 2
        : prevStatus === STATUS_R3
        ? 3
        : prevStatus === STATUS_R4
        ? 4
        : null;

    if (prevRound === null) {
      // mastered or none — review outcome arriving for non-pending stage is
      // unusual; ignore silently to avoid corrupting state.
      summary.unchanged++;
      continue;
    }

    if (o.passed) {
      const nextRound = nextRoundOnPass(prevRound as 1 | 2 | 3 | 4);
      if (nextRound === "mastered") {
        await upsertProgress(adminClient, ctx.authUserId, o.stageId, {
          review_status: STATUS_MASTERED,
          review_round: null,
          retry_count: prevRetry,
          last_review_completed_at: now,
          next_review_at: null,
        });
        summary.mastered++;
      } else {
        const days = intervalDaysForRound(nextRound, prevRetry);
        const scheduledAt = nextMorningInDays(ctx.timezone, 9, days);
        const sid = await insertReviewSchedule(adminClient, ctx, {
          cardId: o.cardId,
          round: nextRound,
          scheduledAt,
        });
        await upsertProgress(adminClient, ctx.authUserId, o.stageId, {
          review_status: statusForRound(nextRound),
          review_round: nextRound,
          retry_count: prevRetry,
          last_review_completed_at: now,
          next_review_at: scheduledAt,
        });
        summary.promoted++;
        summary.scheduleIds.push(sid.toString());
      }
    } else {
      // Failed → reset to r1.
      const newRetry = prevRetry + 1;
      const days = intervalDaysForRound(1, newRetry);
      const scheduledAt = nextMorningInDays(ctx.timezone, 9, days);
      const sid = await insertReviewSchedule(adminClient, ctx, {
        cardId: o.cardId,
        round: 1,
        scheduledAt,
      });
      await upsertProgress(adminClient, ctx.authUserId, o.stageId, {
        review_status: STATUS_R1,
        review_round: 1,
        retry_count: newRetry,
        last_review_completed_at: now,
        next_review_at: scheduledAt,
      });
      summary.refreshed++;
      summary.scheduleIds.push(sid.toString());
    }
  }

  return summary;
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
 * Multi-id variant for aggregated review delivery (Option B).
 * Returns only schedules the calling user owns. Filters out any unowned
 * or non-hyper_sync_review rows defensively.
 */
export async function getHyperSyncReviewSchedules(
  adminClient: SupabaseClient<Database>,
  schedule_ids: (string | bigint)[],
  auth_user_id: string
) {
  if (schedule_ids.length === 0) return [];
  const numericIds = schedule_ids.map((id) => id as unknown as number);

  const { data, error } = await adminClient
    .from("nv2_schedules")
    .select(
      "schedule_id, auth_user_id, message_body, scheduled_at, sent_at, opened_at, status, review_round"
    )
    .in("schedule_id", numericIds)
    .eq("schedule_type", "hyper_sync_review");

  if (error) throw new Error(error.message);

  return (data ?? []).filter((row) => row.auth_user_id === auth_user_id);
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

/** Bulk version — used by the multi-schedule review page. */
export async function markHyperSyncReviewsOpened(
  adminClient: SupabaseClient<Database>,
  schedule_ids: (string | bigint)[]
) {
  if (schedule_ids.length === 0) return;
  const numericIds = schedule_ids.map((id) => id as unknown as number);
  const { error } = await adminClient
    .from("nv2_schedules")
    .update({ opened_at: new Date().toISOString() })
    .in("schedule_id", numericIds)
    .is("opened_at", null);

  if (error) throw new Error(error.message);
}
