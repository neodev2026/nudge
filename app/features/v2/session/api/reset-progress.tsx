/**
 * POST /api/v2/sessions/:sessionId/reset-progress
 *
 * Testing helper — resets stage progress for all stages in a session.
 *
 * is_review = false (학습 상태 초기화):
 *   Deletes all nv2_stage_progress rows for the session's stages.
 *   Also resets nv2_sessions.status back to "in_progress".
 *
 * is_review = true (복습 상태 초기화):
 *   Sets last_review_completed_at = NULL for learning stages.
 *   Also resets nv2_sessions.status back to "in_progress".
 *
 * Security: only works when RESET_PROGRESS_ENABLED=true env var is set.
 * Remove or disable in production.
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/reset-progress";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  // Guard: only enabled when explicitly set
  if (process.env.RESET_PROGRESS_ENABLED !== "true") {
    return routeData({ error: "Not enabled" }, { status: 403 });
  }

  let body: { auth_user_id?: string; is_review?: boolean };
  try {
    body = await request.json();
  } catch {
    return routeData({ error: "Invalid JSON" }, { status: 400 });
  }

  const { auth_user_id, is_review = false } = body;
  if (!auth_user_id) {
    return routeData({ error: "auth_user_id required" }, { status: 400 });
  }

  const session_id = params.sessionId;

  const service_client = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all stage IDs in this session
  const { data: session_row } = await service_client
    .from("nv2_sessions")
    .select("product_session_id")
    .eq("session_id", session_id)
    .maybeSingle();

  if (!session_row) {
    return routeData({ error: "Session not found" }, { status: 404 });
  }

  const { data: pss_rows } = await service_client
    .from("nv2_product_session_stages")
    .select("stage_id, nv2_stages!inner(stage_type)")
    .eq("product_session_id", session_row.product_session_id);

  const stage_ids = (pss_rows ?? []).map((r) => r.stage_id);

  if (stage_ids.length === 0) {
    return routeData({ ok: true, reset_count: 0 });
  }

  let reset_count = 0;

  if (is_review) {
    // Review reset: set last_review_completed_at to epoch sentinel.
    // Supabase JS v2 silently ignores null in .update(), so we use
    // "1970-01-01" which is always < any real session.created_at.
    const EPOCH = "1970-01-01T00:00:00.000Z";
    const { error } = await service_client
      .from("nv2_stage_progress")
      .update({ last_review_completed_at: EPOCH } as any)
      .eq("auth_user_id", auth_user_id)
      .in("stage_id", stage_ids);

    if (error) throw error;
    reset_count = stage_ids.length;
  } else {
    // Full reset: delete all progress rows for these stages
    const { error, count } = await service_client
      .from("nv2_stage_progress")
      .delete({ count: "exact" })
      .eq("auth_user_id", auth_user_id)
      .in("stage_id", stage_ids);

    if (error) throw error;
    reset_count = count ?? 0;
  }

  // Reset session status back to in_progress
  await service_client
    .from("nv2_sessions")
    .update({ status: "in_progress", completed_at: null })
    .eq("session_id", session_id)
    .eq("auth_user_id", auth_user_id);

  return routeData({ ok: true, reset_count, is_review });
}
