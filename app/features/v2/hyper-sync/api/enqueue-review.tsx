/**
 * POST /api/v2/hyper-sync/enqueue-review
 *
 * Applies session verdicts (both 기억함 and 기억못함) to the SRS state and
 * enqueues review schedules accordingly. Anonymous users get a 200 with
 * { skipped: true, reason: 'anonymous' }.
 *
 * Request body (JSON):
 *   {
 *     product_slug:      string,
 *     source_session_id: string,
 *     outcomes: [{ stage_id: string, card_id: string, verdict: 'known' | 'unknown' }, ...]
 *   }
 *
 * SRS rules (see spec §6.6 v2.2):
 *   - none + known        → r2_pending (+3d)
 *   - none + unknown      → r1_pending (+1d), retry_count=1
 *   - pending + known     → no-op
 *   - pending + unknown   → refresh: cancel old, r1_pending (+1d), retry_count++
 *   - mastered + known    → no-op
 *   - mastered + unknown  → r1_pending (+1d), retry_count++
 *
 * Auth: requires a logged-in Supabase user. timezone read from nv2_profiles.
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/enqueue-review";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  applyHyperSyncSessionOutcomes,
  type SessionStageOutcome,
} from "../lib/queries.server";

interface RawOutcome {
  stage_id?: string;
  card_id?: string;
  verdict?: string;
}
interface EnqueueBody {
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
    return routeData(
      { skipped: true, reason: "anonymous" },
      { status: 200 }
    );
  }

  let body: EnqueueBody;
  try {
    body = (await request.json()) as EnqueueBody;
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

  // Validate each outcome shape and reject invalid rows up-front.
  const cleaned: SessionStageOutcome[] = [];
  for (const o of outcomes) {
    if (
      typeof o.stage_id === "string" &&
      typeof o.card_id === "string" &&
      (o.verdict === "known" || o.verdict === "unknown")
    ) {
      cleaned.push({
        stageId: o.stage_id,
        cardId: o.card_id,
        verdict: o.verdict,
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
    const summary = await applyHyperSyncSessionOutcomes(
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
    console.error("[hyper-sync/enqueue-review] failed:", msg);
    return routeData({ error: msg }, { status: 500 });
  }
}
