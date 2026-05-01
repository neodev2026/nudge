/**
 * /products/:slug/marathon/:runId/resume
 *
 * DM nudge resume entry point. Identifies the user via runId (UUID acts as
 * security token — same pattern as nv2_sessions.session_id) so no auth cookie
 * is required. Used when opening the DM link inside a messenger in-app browser.
 *
 * Skips the entry screen and auto-starts the marathon stream from last_stage_index.
 */
import type { LoaderFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import {
  getMarathonProduct,
  getMarathonStages,
} from "../lib/queries.server";

export async function loader({ params }: LoaderFunctionArgs) {
  const { slug, runId } = params;
  if (!slug || !runId) throw new Response("Not Found", { status: 404 });

  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: run } = await adminClient
    .from("nv2_marathon_runs")
    .select("id, auth_user_id, product_id, last_stage_index, run_number")
    .eq("id", runId)
    .eq("status", "in_progress")
    .maybeSingle();

  if (!run) throw new Response("Run not found", { status: 404 });

  const [product, stages] = await Promise.all([
    getMarathonProduct(adminClient, slug),
    getMarathonStages(adminClient, run.product_id),
  ]);

  if (!product) throw new Response("Not Found", { status: 404 });

  return {
    productSlug: slug,
    productName: product.name,
    productId: product.id,
    userId: run.auth_user_id,
    stages,
    inProgressRun: {
      id: run.id,
      run_number: run.run_number,
      last_stage_index: run.last_stage_index,
    },
    autoResume: true,
  };
}

export { default } from "./marathon-page";
