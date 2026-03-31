/**
 * POST /api/v2/cron/dispatch
 *
 * Main cron job — runs daily (recommended: 08:00 KST = 23:00 UTC).
 *
 * Three tasks in order:
 *   1. Auto-send next session for users who completed their last session
 *   2. Send nudge DM to users with incomplete sessions (no DM in 20+ hours)
 *   3. Send review DM to users with stage progress due for review
 *
 * Security:
 *   Requires Authorization: Bearer {CRON_SECRET} header.
 *   Uses Supabase service-role client to bypass RLS.
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/dispatch";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import {
  getCronUsersNeedingNextSession,
  getCronSessionsNeedingNudge,
  getCronStageProgressDueForReview,
  getProductSessionContainingStage,
  createCronNewSession,
  createCronReviewSession,
} from "../lib/queries.server";
import {
  sendSessionDm,
  sendSessionCompleteDm,
} from "~/features/v2/auth/lib/discord.server";
import {
  getNv2NextUnstartedProductSession,
} from "~/features/v2/session/lib/queries.server";
import type { SnsType } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get("Authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Service-role client (bypasses RLS)
// ---------------------------------------------------------------------------

function makeServiceClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  if (!verifyCronSecret(request)) {
    return routeData({ error: "Unauthorized" }, { status: 401 });
  }

  const client = makeServiceClient();
  const origin = new URL(request.url).origin;
  const now = new Date().toISOString();

  const results = {
    next_sessions_sent: 0,
    nudges_sent: 0,
    reviews_sent: 0,
    errors: [] as string[],
  };

  // ── Task 1: Auto-send next session ────────────────────────────────────────
  try {
    const completed_sessions = await getCronUsersNeedingNextSession(client);

    // Deduplicate by (sns_type, sns_id, product_id) — take latest completed
    const seen = new Set<string>();
    for (const s of completed_sessions) {
      const ps = s.nv2_product_sessions as any;
      if (!ps) continue;

      const key = `${s.sns_type}:${s.sns_id}:${ps.product_id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const sns_type = s.sns_type as SnsType;
      const sns_id = s.sns_id;

      // Find next unstarted product session
      const next_ps = await getNv2NextUnstartedProductSession(
        client,
        sns_type,
        sns_id,
        ps.product_id
      ).catch(() => null);

      if (!next_ps) continue; // All sessions completed

      // Create new user session
      const new_session = await createCronNewSession(
        client,
        sns_type,
        sns_id,
        next_ps.id,
        now
      ).catch(() => null);

      if (!new_session) continue;

      const session_url = `${origin}/sessions/${new_session.session_id}`;

      await sendSessionDm(
        sns_id,
        session_url,
        next_ps.title ?? `Session ${next_ps.session_number}`,
        0 // stage count — cron doesn't need to fetch it
      ).catch((err) => {
        results.errors.push(`sendSessionDm failed for ${sns_id}: ${err.message}`);
      });

      results.next_sessions_sent++;
    }
  } catch (err: any) {
    results.errors.push(`Task1 failed: ${err.message}`);
  }

  // ── Task 2: Nudge incomplete sessions ─────────────────────────────────────
  try {
    const incomplete = await getCronSessionsNeedingNudge(client);

    for (const s of incomplete) {
      const session_url = `${origin}/sessions/${s.session_id}`;

      // Reuse sendSessionDm with a nudge-appropriate title
      await sendSessionDm(
        s.sns_id,
        session_url,
        "오늘 학습을 완료해볼까요? 🔔",
        0
      ).catch((err) => {
        results.errors.push(`nudge failed for ${s.sns_id}: ${err.message}`);
      });

      // Update dm_sent_at so we don't nudge again for 20 hours
      await client
        .from("nv2_sessions")
        .update({ dm_sent_at: now })
        .eq("session_id", s.session_id);

      results.nudges_sent++;
    }
  } catch (err: any) {
    results.errors.push(`Task2 failed: ${err.message}`);
  }

  // ── Task 3: Send review DMs ───────────────────────────────────────────────
  try {
    const due_reviews = await getCronStageProgressDueForReview(client);

    // Group by (sns_type, sns_id, product_session) to send one DM per session
    const review_map = new Map<
      string,
      {
        sns_type: SnsType;
        sns_id: string;
        product_session_id: string;
        review_round: number;
        stage_ids: string[];
      }
    >();

    for (const row of due_reviews) {
      const stage = row.nv2_stages as any;
      if (!stage) continue;

      // Find the product_session containing this stage
      const pss = await getProductSessionContainingStage(
        client,
        row.stage_id
      ).catch(() => null);

      if (!pss) continue;

      const ps = pss.nv2_product_sessions as any;
      const round = row.review_round ?? 1;
      const key = `${row.sns_type}:${row.sns_id}:${pss.product_session_id}`;

      if (!review_map.has(key)) {
        review_map.set(key, {
          sns_type: row.sns_type as SnsType,
          sns_id: row.sns_id,
          product_session_id: pss.product_session_id,
          review_round: round,
          stage_ids: [],
        });
      }
      review_map.get(key)!.stage_ids.push(row.stage_id);
    }

    for (const [, info] of review_map) {
      // Create review session
      const review_session = await createCronReviewSession(
        client,
        info.sns_type,
        info.sns_id,
        info.product_session_id,
        info.review_round,
        now
      ).catch(() => null);

      if (!review_session) continue;

      const session_url = `${origin}/sessions/${review_session.session_id}`;
      const round_label = `${info.review_round}차 복습`;

      await sendSessionDm(
        info.sns_id,
        session_url,
        `${round_label} — 기억이 날까요? 🔄`,
        info.stage_ids.length
      ).catch((err) => {
        results.errors.push(
          `review DM failed for ${info.sns_id}: ${err.message}`
        );
      });

      results.reviews_sent++;
    }
  } catch (err: any) {
    results.errors.push(`Task3 failed: ${err.message}`);
  }

  return routeData({ ok: true, results });
}
