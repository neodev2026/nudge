/**
 * POST /api/v2/marathon/:runId/save-progress
 *
 * Updates last_stage_index for an in_progress marathon run.
 * Called after each stage is completed in the stream.
 *
 * Body: { last_stage_index: number }
 *
 * Uses a raw SQL update to atomically increment season_progress by the delta
 * between the new and current last_stage_index. This lets DM-resumed runs and
 * existing in-progress runs contribute to the season ranking without counting
 * pre-season accumulated progress.
 */
import type { ActionFunctionArgs } from "react-router";
import { sql } from "drizzle-orm";
import db from "~/core/db/drizzle-client.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const { runId } = params;
  if (!runId) return Response.json({ ok: false, error: "missing runId" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const { last_stage_index } = body;
  if (typeof last_stage_index !== "number") {
    return Response.json({ ok: false, error: "invalid last_stage_index" }, { status: 400 });
  }

  // runId (UUID v4) acts as the security token — same model as nv2_sessions.session_id.
  // No auth cookie required; the unguessable UUID is sufficient for identity verification.
  //
  // season_progress is incremented by GREATEST(0, new_index - current_index) so that
  // only stages newly completed during this session are counted. Pre-season accumulated
  // progress is never included in the delta.
  await db.execute(sql`
    UPDATE nv2_marathon_runs
    SET
      season_progress = season_progress + GREATEST(0, ${last_stage_index}::int - last_stage_index),
      last_stage_index = ${last_stage_index},
      updated_at = NOW()
    WHERE id = ${runId}::uuid
      AND status = 'in_progress'
  `);

  return Response.json({ ok: true });
}
