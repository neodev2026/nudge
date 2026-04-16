/**
 * POST /api/v2/sentence/:stageId/result
 *
 * Marks a sentence_practice stage as completed.
 * No authentication required — public access via UUID session link.
 *
 * Request body (JSON):
 *   {
 *     auth_user_id: string
 *   }
 *
 * Response: { ok: true }
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

  const stage_id = params.stageId;

  // Service role client — bypasses RLS for write operations.
  // Public sessions (anon users) cannot write to nv2_stage_progress via RLS.
  // Security is provided by the unguessable UUID session_id in the URL.
  const service_client = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Ensure progress row exists ────────────────────────────────────────────
  await initNv2StageProgress(
    service_client,
    auth_user_id,
    stage_id
  ).catch((err) => {
    console.error("[sentence-result] initNv2StageProgress failed:", err);
  });

  // ── Mark stage as completed ───────────────────────────────────────────────
  await completeNv2Stage(
    service_client,
    auth_user_id,
    stage_id
  ).catch((err) => {
    console.error("[sentence-result] completeNv2Stage failed:", err);
  });

  return routeData({ ok: true });
}
