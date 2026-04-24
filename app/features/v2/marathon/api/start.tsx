/**
 * POST /api/v2/marathon/:productSlug/start
 *
 * Creates or resets a marathon run for the authenticated user.
 *
 * Body: { restart: boolean }
 *   restart=false — return existing in_progress run, or create new if none
 *   restart=true  — reset existing in_progress run (index=0) or create new
 *
 * Returns: { ok: true, run_id: string, last_stage_index: number }
 */
import type { ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import makeServerClient from "~/core/lib/supa-client.server";

export async function action({ request, params }: ActionFunctionArgs) {
  const { productSlug } = params;
  if (!productSlug) return Response.json({ ok: false, error: "missing slug" }, { status: 400 });

  const [client] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const restart = body?.restart === true;

  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Resolve product_id from slug
  const { data: product } = await adminClient
    .from("nv2_learning_products")
    .select("id")
    .eq("slug", productSlug)
    .eq("is_active", true)
    .single();

  if (!product) return Response.json({ ok: false, error: "product not found" }, { status: 404 });

  const auth_user_id = user.id;
  const product_id = product.id;

  // Check for existing in_progress run
  const { data: existing } = await adminClient
    .from("nv2_marathon_runs")
    .select("id, run_number, last_stage_index")
    .eq("auth_user_id", auth_user_id)
    .eq("product_id", product_id)
    .eq("status", "in_progress")
    .maybeSingle();

  if (!restart && existing) {
    // Resume: return existing run as-is
    return Response.json({
      ok: true,
      run_id: existing.id,
      last_stage_index: existing.last_stage_index,
    });
  }

  if (restart && existing) {
    // Reset existing in_progress run back to the beginning
    const { error } = await adminClient
      .from("nv2_marathon_runs")
      .update({
        last_stage_index: 0,
        started_at: new Date().toISOString(),
        score: null,
        total_questions: null,
        elapsed_seconds: null,
        completed_at: null,
      })
      .eq("id", existing.id);

    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    return Response.json({ ok: true, run_id: existing.id, last_stage_index: 0 });
  }

  // No in_progress run — create a new one
  const { count: completed_count } = await adminClient
    .from("nv2_marathon_runs")
    .select("id", { count: "exact", head: true })
    .eq("auth_user_id", auth_user_id)
    .eq("product_id", product_id)
    .eq("status", "completed");

  const run_number = (completed_count ?? 0) + 1;

  const { data: new_run, error: insert_error } = await adminClient
    .from("nv2_marathon_runs")
    .insert({
      auth_user_id,
      product_id,
      run_number,
      status: "in_progress",
      last_stage_index: 0,
    })
    .select("id")
    .single();

  if (insert_error || !new_run) {
    return Response.json({ ok: false, error: insert_error?.message }, { status: 500 });
  }

  return Response.json({ ok: true, run_id: new_run.id, last_stage_index: 0 });
}
