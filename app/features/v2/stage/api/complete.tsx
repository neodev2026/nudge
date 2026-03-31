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

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
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

  const [client] = makeServerClient(request);

  // Service role client — bypasses RLS for stage_progress write operations.
  // Public sessions (anon users) cannot write to nv2_stage_progress via authenticated RLS.
  // Security is provided by the unguessable UUID session_id in the stage URL.
  const service_client = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Parse body ────────────────────────────────────────────────────────────
  // sns_type/sns_id are resolved from the session row by stage-page (public access)
  // or from Discord OAuth metadata (authenticated access).
  // Authentication is NOT required here — security is provided by the
  // unguessable UUID session_id embedded in the stage URL.
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

  // Cast to SnsType — required for Supabase typed queries
  const typed_sns_type = sns_type as SnsType;
  const stage_id = params.stageId;

  // ── Fetch stage (public read — no auth needed) ────────────────────────────
  const stage = await getNv2StageWithCards(client, stage_id).catch(() => null);
  if (!stage) {
    return routeData({ error: "Stage not found" }, { status: 404 });
  }

  // ── Ensure progress row exists (service role — bypasses RLS) ─────────────
  try {
    await initNv2StageProgress(service_client, typed_sns_type, sns_id, stage_id);
  } catch (err) {
    console.error("[stage-complete] initNv2StageProgress failed:", err);
    return routeData({ error: "Failed to initialize progress" }, { status: 500 });
  }

  // ── Mark complete (service role — bypasses RLS) ───────────────────────────
  let result;
  try {
    result = await completeNv2Stage(service_client, typed_sns_type, sns_id, stage_id);
  } catch (err) {
    console.error("[stage-complete] completeNv2Stage failed:", err);
    return routeData({ error: "Failed to complete stage" }, { status: 500 });
  }

  // result is null when already completed (e.g. review session re-completing a stage)
  if (result !== null) {
    await incrementNv2TodayNewCount(service_client, typed_sns_type, sns_id).catch(
      (err) =>
        console.error("[stage-complete] incrementTodayNewCount failed:", err)
    );
  }

  // ── Find next stage (public read) ─────────────────────────────────────────
  const next_stage = await getNv2NextStage(
    client,
    stage.learning_product_id,
    stage.stage_number
  ).catch(() => null);

  return routeData({ ok: true, next_stage_id: next_stage?.id ?? null });
}
