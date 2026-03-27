/**
 * POST /api/v2/stage/:stageId/retry
 *
 * Increments retry_count for the user's progress row on a stage.
 * Called when the user taps "처음부터 다시 보기".
 *
 * Request body (JSON):
 *   { sns_type: string, sns_id: string }
 *
 * Response (JSON):
 *   { ok: true }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — missing sns_type / sns_id
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/retry";

import makeServerClient from "~/core/lib/supa-client.server";
import {
  incrementNv2StageRetry,
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

  // ── Ensure progress row exists, then increment ────────────────────────────
  await initNv2StageProgress(client, sns_type, sns_id, stage_id).catch(
    () => null
  );

  await incrementNv2StageRetry(client, sns_type, sns_id, stage_id);

  return routeData({ ok: true }, { headers });
}
