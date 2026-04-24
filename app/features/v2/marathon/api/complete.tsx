/**
 * POST /api/v2/marathon/:runId/complete
 *
 * Marks a marathon run as completed and stores final quiz answers.
 *
 * Body: {
 *   score: number,
 *   total_questions: number,
 *   elapsed_seconds: number,
 *   answers: Array<{ stage_id: string, question_direction: string, is_correct: boolean }>
 * }
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
  const { score, total_questions, elapsed_seconds, answers } = body;

  if (
    typeof score !== "number" ||
    typeof total_questions !== "number" ||
    typeof elapsed_seconds !== "number" ||
    !Array.isArray(answers)
  ) {
    return Response.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();

  // Mark run as completed
  const { error: run_error } = await adminClient
    .from("nv2_marathon_runs")
    .update({
      status: "completed",
      score,
      total_questions,
      elapsed_seconds,
      completed_at: now,
      last_stage_index: total_questions, // set to end to prevent stale resume
    })
    .eq("id", runId)
    .eq("auth_user_id", user.id)
    .eq("status", "in_progress");

  if (run_error) return Response.json({ ok: false, error: run_error.message }, { status: 500 });

  // Insert final quiz answers (ignore duplicates via unique index conflict)
  if (answers.length > 0) {
    const rows = answers.map((a: any) => ({
      run_id: runId,
      stage_id: a.stage_id,
      question_direction: a.question_direction,
      is_correct: a.is_correct,
      answered_at: now,
    }));

    const { error: ans_error } = await adminClient
      .from("nv2_marathon_answers")
      .upsert(rows, { onConflict: "run_id,stage_id", ignoreDuplicates: true });

    if (ans_error) return Response.json({ ok: false, error: ans_error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
