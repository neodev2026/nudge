/**
 * POST /api/v2/stage/:stageId/complete
 *
 * Marks a stage as completed for the authenticated user.
 *
 * Request body (JSON):
 *   { sns_type: string, sns_id: string }
 *
 * Response (JSON):
 *   { ok: true, next_stage_id: string | null }
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/complete";

import makeServerClient from "~/core/lib/supa-client.server";
import {
  completeNv2Stage,
  getNv2NextStage,
  getNv2StageWithCards,
  incrementNv2TodayNewCount,
  initNv2StageProgress,
} from "../lib/queries.server";
import type { SnsType } from "~/features/v2/shared/types";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client, headers] = makeServerClient(request);

  // ── Auth check ────────────────────────────────────────────────────────────
  const { data: session_data } = await client.auth.getSession();
  if (!session_data.session) {
    return routeData({ error: "Unauthorized" }, { status: 401, headers });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { sns_type?: string; sns_id?: string };
  try {
    body = await request.json();
  } catch {
    return routeData({ error: "Invalid JSON body" }, { status: 400, headers });
  }

  const { sns_type, sns_id } = body;
  if (!sns_type || !sns_id) {
    return routeData(
      { error: "sns_type and sns_id are required" },
      { status: 400, headers }
    );
  }

  // Cast to SnsType — required for Supabase typed queries
  const typed_sns_type = sns_type as SnsType;
  const stage_id = params.stageId;

  // ── Fetch stage ───────────────────────────────────────────────────────────
  const stage = await getNv2StageWithCards(client, stage_id).catch(() => null);
  if (!stage) {
    return routeData({ error: "Stage not found" }, { status: 404, headers });
  }

  // ── Ensure progress row exists ────────────────────────────────────────────
  try {
    await initNv2StageProgress(client, typed_sns_type, sns_id, stage_id);
  } catch (err) {
    console.error("[stage-complete] initNv2StageProgress failed:", err);
    return routeData(
      { error: "Failed to initialize progress" },
      { status: 500, headers }
    );
  }

  // ── Mark complete ─────────────────────────────────────────────────────────
  let result;
  try {
    result = await completeNv2Stage(client, typed_sns_type, sns_id, stage_id);
  } catch (err) {
    console.error("[stage-complete] completeNv2Stage failed:", err);
    return routeData(
      { error: "Failed to complete stage" },
      { status: 500, headers }
    );
  }

  // result is null when already completed (e.g. review session re-completing a stage)
  // Treat as idempotent success — still return ok:true so the client can redirect
  if (result !== null) {
    await incrementNv2TodayNewCount(client, typed_sns_type, sns_id).catch(
      (err) =>
        console.error("[stage-complete] incrementTodayNewCount failed:", err)
    );
  }

  // ── Find next stage ───────────────────────────────────────────────────────
  const next_stage = await getNv2NextStage(
    client,
    stage.learning_product_id,
    stage.stage_number
  ).catch(() => null);

  return routeData(
    { ok: true, next_stage_id: next_stage?.id ?? null },
    { headers }
  );
}
