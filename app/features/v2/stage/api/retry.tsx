/**
 * POST /api/v2/stage/:stageId/retry
 *
 * Increments retry_count for the user's progress row on a stage.
 * Called when the user taps "처음부터 다시 보기".
 *
 * No authentication required — public sessions resolve sns_id from session row.
 * Security is provided by the unguessable UUID session_id in the stage URL.
 *
 * Request body (JSON):
 *   { sns_type: string, sns_id: string }
 *
 * Response (JSON):
 *   { ok: true }
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/retry";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import {
  incrementNv2StageRetry,
  initNv2StageProgress,
} from "../lib/queries.server";
import type { SnsType } from "~/features/v2/shared/types";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { sns_type?: string; sns_id?: string };
  try {
    body = await request.json();
  } catch {
    return routeData({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sns_type, sns_id } = body;
  if (!sns_type || !sns_id) {
    return routeData(
      { error: "sns_type and sns_id are required" },
      { status: 400 }
    );
  }

  const typed_sns_type = sns_type as SnsType;
  const stage_id = params.stageId;

  // Service role client — bypasses RLS for stage_progress write operations
  const service_client = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Ensure progress row exists, then increment ────────────────────────────
  await initNv2StageProgress(service_client, typed_sns_type, sns_id, stage_id).catch(
    () => null
  );

  await incrementNv2StageRetry(service_client, typed_sns_type, sns_id, stage_id);

  return routeData({ ok: true });
}
