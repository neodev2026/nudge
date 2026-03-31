/**
 * POST /api/v2/quiz/:stageId/result
 *
 * Saves quiz result and marks the quiz stage as completed
 * so the session can detect all stages are done.
 *
 * No authentication required — public access via UUID session link.
 *
 * Request body (JSON):
 *   {
 *     sns_type: string,
 *     sns_id: string,
 *     matched_pairs_count: number,
 *     covered_stage_ids: string,  // comma-separated
 *     duration_seconds: number
 *   }
 *
 * Response: { ok: true }
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/result";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  saveQuizResult,
} from "../lib/queries.server";
import {
  initNv2StageProgress,
  completeNv2Stage,
} from "~/features/v2/stage/lib/queries.server";
import type { SnsType } from "~/features/v2/shared/types";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  let body: {
    sns_type?: string;
    sns_id?: string;
    stage_type?: string;
    matched_pairs_count?: number;
    covered_stage_ids?: string;
    duration_seconds?: number;
  };

  try {
    body = await request.json();
  } catch {
    return routeData({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sns_type, sns_id, stage_type, matched_pairs_count, covered_stage_ids, duration_seconds } = body;

  if (!sns_type || !sns_id) {
    return routeData({ error: "sns_type and sns_id are required" }, { status: 400 });
  }

  const typed_sns_type = sns_type as SnsType;
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

  const [client] = makeServerClient(request);

  // ── Save quiz result ──────────────────────────────────────────────────────
  await saveQuizResult(
    service_client,
    typed_sns_type,
    sns_id,
    stage_id,
    stage_type ?? "quiz_5",
    matched_pairs_count ?? 0,
    covered_ids,
    duration_seconds ?? 0
  ).catch((err) => {
    console.error("[quiz-result] saveQuizResult failed:", err);
  });

  // ── Mark quiz stage as completed ──────────────────────────────────────────
  // This allows session-page to detect all stages are done
  await initNv2StageProgress(
    service_client,
    typed_sns_type,
    sns_id,
    stage_id
  ).catch(() => null);

  await completeNv2Stage(
    service_client,
    typed_sns_type,
    sns_id,
    stage_id
  ).catch((err) => {
    console.error("[quiz-result] completeNv2Stage failed:", err);
  });

  return routeData({ ok: true });
}
