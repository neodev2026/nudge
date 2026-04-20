/**
 * POST /api/v2/story/:stageId/result
 *
 * Marks a story stage as completed for the user.
 * Uses the same completeNv2Stage function as the learning stage complete API,
 * so the stage enters the r1_pending review cycle identically.
 *
 * Request body (JSON):
 *   { auth_user_id: string }
 */
import { data as routeData } from "react-router";
import type { ActionFunctionArgs } from "react-router";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  completeNv2Stage,
  initNv2StageProgress,
  incrementNv2TodayNewCount,
} from "~/features/v2/stage/lib/queries.server";

export async function action({ request, params }: ActionFunctionArgs) {
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
  if (!stage_id) {
    return routeData({ error: "stageId is required" }, { status: 400 });
  }

  // Verify the stage exists via the user-scoped client
  const { data: stage } = await client
    .from("nv2_stages")
    .select("id, stage_type")
    .eq("id", stage_id)
    .maybeSingle();

  if (!stage) {
    return routeData({ error: "Stage not found" }, { status: 404 });
  }

  try {
    await initNv2StageProgress(service_client, auth_user_id, stage_id);
  } catch (err) {
    console.error("[story-result] initNv2StageProgress failed:", err);
    return routeData({ error: "Failed to initialize progress" }, { status: 500 });
  }

  let result;
  try {
    result = await completeNv2Stage(service_client, auth_user_id, stage_id);
  } catch (err) {
    console.error("[story-result] completeNv2Stage failed:", err);
    return routeData({ error: "Failed to complete stage" }, { status: 500 });
  }

  // First completion → increment today_new_count
  if (result !== null) {
    await incrementNv2TodayNewCount(service_client, auth_user_id).catch(
      (err) => console.error("[story-result] incrementTodayNewCount failed:", err)
    );
  }

  return routeData({ ok: true });
}
