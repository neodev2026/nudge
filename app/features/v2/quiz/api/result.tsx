/**
 * POST /api/v2/quiz/:stageId/result
 *
 * Saves quiz result and marks the quiz stage as completed.
 * Returns top ranking for the result screen.
 *
 * No authentication required — public access via UUID session link.
 *
 * Request body (JSON):
 *   {
 *     auth_user_id: string,
 *     stage_type: string,
 *     matched_pairs_count: number,
 *     score: number,               // word+meaning=10pt, audio+meaning=30pt
 *     covered_stage_ids: string,   // comma-separated
 *     duration_seconds: number
 *   }
 *
 * Response: { ok: true, ranking: QuizRankEntry[] }
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/result";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import {
  saveQuizResult,
  getQuizRanking,
} from "../lib/queries.server";
import {
  initNv2StageProgress,
  completeNv2Stage,
} from "~/features/v2/stage/lib/queries.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  let body: {
    auth_user_id?: string;
    stage_type?: string;
    matched_pairs_count?: number;
    score?: number;
    covered_stage_ids?: string;
    duration_seconds?: number;
  };

  try {
    body = await request.json();
  } catch {
    return routeData({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    auth_user_id,
    stage_type,
    matched_pairs_count,
    score,
    covered_stage_ids,
    duration_seconds,
  } = body;

  if (!auth_user_id) {
    return routeData(
      { error: "auth_user_id is required" },
      { status: 400 }
    );
  }

  const stage_id = params.stageId;
  const covered_ids = (covered_stage_ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Service role client — bypasses RLS for write operations
  const service_client = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Save quiz result ──────────────────────────────────────────────────────
  await saveQuizResult(
    service_client,
    auth_user_id,
    stage_id,
    stage_type ?? "quiz_5",
    matched_pairs_count ?? 0,
    score ?? 0,
    covered_ids,
    duration_seconds ?? 0
  ).catch((err) => {
    console.error("[quiz-result] saveQuizResult failed:", err);
  });

  // ── Mark quiz stage as completed ──────────────────────────────────────────
  await initNv2StageProgress(
    service_client,
    auth_user_id,
    stage_id
  ).catch(() => null);

  await completeNv2Stage(
    service_client,
    auth_user_id,
    stage_id
  ).catch((err) => {
    console.error("[quiz-result] completeNv2Stage failed:", err);
  });

  // ── Fetch ranking for result screen ──────────────────────────────────────
  // Use service_client — nv2_quiz_results RLS requires authentication,
  // but ranking is public-facing data on the result screen.
  const ranking = await getQuizRanking(service_client, stage_id).catch(
    () => []
  );

  return routeData({ ok: true, ranking });
}
