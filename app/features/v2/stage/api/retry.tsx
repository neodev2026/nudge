/**
 * POST /api/v2/stage/:stageId/retry
 *
 * Increments retry_count for the user's progress row on a stage.
 * Called when the user taps "처음부터 다시 보기".
 *
 * Request body (JSON):
 *   { auth_user_id: string }
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/retry";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import {
  incrementNv2StageRetry,
  initNv2StageProgress,
} from "../lib/queries.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

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

  const service_client = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await initNv2StageProgress(service_client, auth_user_id, stage_id).catch(() => null);
  await incrementNv2StageRetry(service_client, auth_user_id, stage_id);

  return routeData({ ok: true });
}
