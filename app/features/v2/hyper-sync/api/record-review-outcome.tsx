/**
 * POST /api/v2/hyper-sync/record-review-outcome
 *
 * Applies review verdicts (from /hyper-sync/review completion) to the SRS
 * state. Pass = step 1 [기억함] only (strict, per SRS-1). Fail = anything else
 * (later-step pass OR exhausted 5 steps).
 *
 * Promotes pass to next round (r1→r2→r3→r4→mastered) using the forgetting
 * curve intervals (1/3/7/14 days). Resets fail to r1_pending with
 * retry_count++ — halving rule kicks in once retry_count ≥ 3 (Nudge parity).
 *
 * Request body (JSON):
 *   {
 *     product_slug:      string,
 *     source_session_id: string,
 *     outcomes: [{ stage_id: string, card_id: string, passed: boolean }, ...]
 *   }
 *
 * Auth: requires a logged-in Supabase user (review page already redirects
 * anonymous to /login, so this is a defensive check).
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/record-review-outcome";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  applyHyperSyncReviewOutcomes,
  type ReviewStageOutcome,
} from "../lib/queries.server";

interface RawOutcome {
  stage_id?: string;
  card_id?: string;
  passed?: boolean;
}
interface RecordBody {
  product_slug?: string;
  source_session_id?: string;
  outcomes?: RawOutcome[];
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return routeData({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RecordBody;
  try {
    body = (await request.json()) as RecordBody;
  } catch {
    return routeData({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { product_slug, source_session_id, outcomes } = body;
  if (!product_slug || !source_session_id || !Array.isArray(outcomes)) {
    return routeData(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const cleaned: ReviewStageOutcome[] = [];
  for (const o of outcomes) {
    if (
      typeof o.stage_id === "string" &&
      typeof o.card_id === "string" &&
      typeof o.passed === "boolean"
    ) {
      cleaned.push({
        stageId: o.stage_id,
        cardId: o.card_id,
        passed: o.passed,
      });
    }
  }

  if (cleaned.length === 0) {
    return routeData(
      { skipped: true, reason: "no_valid_outcomes" },
      { status: 200 }
    );
  }

  const admin = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("nv2_profiles")
    .select("timezone")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const timezone = profile?.timezone ?? "Asia/Seoul";
  const origin = new URL(request.url).origin;

  try {
    const summary = await applyHyperSyncReviewOutcomes(
      admin as any,
      {
        authUserId: user.id,
        productSlug: product_slug,
        sourceSessionId: source_session_id,
        timezone,
        origin,
      },
      cleaned
    );

    return routeData({ ok: true, summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[hyper-sync/record-review-outcome] failed:", msg);
    return routeData({ error: msg }, { status: 500 });
  }
}
