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
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — missing sns_type / sns_id
 *   404 — stage not found
 *   409 — already completed (idempotent — returns ok: true)
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

  const stage_id = params.stageId;

  // ── Fetch stage ───────────────────────────────────────────────────────────
  const stage = await getNv2StageWithCards(client, stage_id).catch(() => null);
  if (!stage) {
    return routeData({ error: "Stage not found" }, { status: 404, headers });
  }

  // ── Ensure progress row exists ────────────────────────────────────────────
  await initNv2StageProgress(client, sns_type, sns_id, stage_id).catch(
    () => null // non-fatal if already exists
  );

  // ── Mark complete ─────────────────────────────────────────────────────────
  const result = await completeNv2Stage(client, sns_type, sns_id, stage_id);

  // result is null when already completed — treat as idempotent success
  if (result !== null) {
    // Increment today's new count on the profile (non-fatal on error)
    await incrementNv2TodayNewCount(client, sns_type, sns_id).catch(() => null);
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
