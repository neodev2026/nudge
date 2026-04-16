/**
 * POST /api/v2/stage/:stageId/complete
 *
 * Marks a stage as completed for the user.
 *
 * Request body (JSON):
 *   { auth_user_id: string }
 *
 * Security: auth_user_id is resolved from the session row (unguessable UUID).
 * Service role is used for write operations to bypass RLS.
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

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client] = makeServerClient(request);

  const service_client = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let body: { auth_user_id?: string };
  try {
    body = await request.json();
  } catch {
    return routeData({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { auth_user_id } = body;
  if (!auth_user_id) {
    return routeData({ error: "auth_user_id is required" }, { status: 400 });
  }

  const stage_id = params.stageId;

  const stage = await getNv2StageWithCards(client, stage_id).catch(() => null);
  if (!stage) {
    return routeData({ error: "Stage not found" }, { status: 404 });
  }

  try {
    await initNv2StageProgress(service_client, auth_user_id, stage_id);
  } catch (err) {
    console.error("[stage-complete] initNv2StageProgress failed:", err);
    return routeData({ error: "Failed to initialize progress" }, { status: 500 });
  }

  let result;
  try {
    result = await completeNv2Stage(service_client, auth_user_id, stage_id);
  } catch (err) {
    console.error("[stage-complete] completeNv2Stage failed:", err);
    return routeData({ error: "Failed to complete stage" }, { status: 500 });
  }

  if (result !== null) {
    await incrementNv2TodayNewCount(service_client, auth_user_id).catch(
      (err) => console.error("[stage-complete] incrementTodayNewCount failed:", err)
    );
  }

  const next_stage = await getNv2NextStage(
    client,
    stage.learning_product_id,
    stage.stage_number
  ).catch(() => null);

  return routeData({ ok: true, next_stage_id: next_stage?.id ?? null });
}
