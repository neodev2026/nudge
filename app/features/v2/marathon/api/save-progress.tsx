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
import makeServerClient from "~/core/lib/supa-client.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const { runId } = params;
  if (!runId) return Response.json({ ok: false, error: "missing runId" }, { status: 400 });

  const [client] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { last_stage_index } = body;
  if (typeof last_stage_index !== "number") {
    return Response.json({ ok: false, error: "invalid last_stage_index" }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await adminClient
    .from("nv2_marathon_runs")
    .update({ last_stage_index })
    .eq("id", runId)
    .eq("auth_user_id", user.id)
    .eq("status", "in_progress");

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
