/**
 * POST /api/v2/marathon/:runId/save-progress
 *
 * Updates last_stage_index for an in_progress marathon run.
 * Called after each stage is completed in the stream.
 *
 * Body: { last_stage_index: number }
 */
import type { ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";

export async function action({ request, params }: ActionFunctionArgs) {
  const { runId } = params;
  if (!runId) return Response.json({ ok: false, error: "missing runId" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const { last_stage_index } = body;
  if (typeof last_stage_index !== "number") {
    return Response.json({ ok: false, error: "invalid last_stage_index" }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // runId (UUID v4) acts as the security token — same model as nv2_sessions.session_id.
  // No auth cookie required; the unguessable UUID is sufficient for identity verification.
  const { error } = await adminClient
    .from("nv2_marathon_runs")
    .update({ last_stage_index })
    .eq("id", runId)
    .eq("status", "in_progress");

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
