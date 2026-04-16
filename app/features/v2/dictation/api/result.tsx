/**
 * POST /api/v2/dictation/:stageId/result
 *
 * Marks a dictation stage as completed.
 * Mirrors sentence/api/result.tsx.
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/result";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import {
  initNv2StageProgress,
  completeNv2Stage,
} from "~/features/v2/stage/lib/queries.server";

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
    return routeData(
      { error: "auth_user_id is required" },
      { status: 400 }
    );
  }

  const service_client = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await initNv2StageProgress(
    service_client,
    auth_user_id,
    params.stageId
  ).catch((err) => console.error("[dictation-result] init failed:", err));

  await completeNv2Stage(
    service_client,
    auth_user_id,
    params.stageId
  ).catch((err) => console.error("[dictation-result] complete failed:", err));

  return routeData({ ok: true });
}
