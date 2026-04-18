/**
 * POST /api/v2/sessions/:sessionId/complete
 *
 * Marks a session as completed.
 * Security: unguessable UUID session_id acts as token.
 * auth_user_id resolved from the session row (no login required).
 *
 * Behaviour:
 *   new    → schedules r1 review, pre-creates next session, sends DM
 *   review → advances review_status (r1→r2→r3→r4→mastered), sends DM
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/complete";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  completeNv2UserSession,
  getNv2ProductSessionWithStages,
  getNv2NextProductSession,
  createNv2UserSession,
  getSessionIdentity,
} from "~/features/v2/session/lib/queries.server";
import { sendSessionCompleteDm } from "~/features/v2/auth/lib/discord.server";
import {
  advanceCronReviewProgress,
  calcNextReviewAt,
} from "~/features/v2/cron/lib/queries.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client] = makeServerClient(request);

  const service_client = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Resolve identity from session row
  const identity = await getSessionIdentity(client, params.sessionId).catch(() => null);
  if (!identity) {
    return routeData({ error: "Session not found" }, { status: 404 });
  }

  const { auth_user_id } = identity;
  const is_anonymous = auth_user_id.startsWith("anon:");

  await completeNv2UserSession(service_client, params.sessionId);

  const product_session = await getNv2ProductSessionWithStages(
    client,
    identity.product_session_id
  ).catch(() => null);

  if (!product_session) {
    return routeData({ ok: true, next_session_id: null, is_anonymous });
  }

  // Anonymous trial sessions: skip next session creation and DM
  if (is_anonymous) {
    return routeData({ ok: true, next_session_id: null, is_anonymous: true });
  }

  // Fetch product name for DM context
  const { data: product_row } = await service_client
    .from("nv2_learning_products")
    .select("name")
    .eq("id", product_session.product_id)
    .maybeSingle();
  const product_name = product_row?.name ?? "";

  // Fetch discord_id for DM delivery
  const { data: profile_row } = await service_client
    .from("nv2_profiles")
    .select("discord_id")
    .eq("auth_user_id", auth_user_id)
    .maybeSingle();
  const discord_id = (profile_row as any)?.discord_id ?? null;

  const learning_stage_ids = (product_session.nv2_product_session_stages ?? [])
    .map((s: any) => s.nv2_stages)
    .filter((s: any) => s?.stage_type === "learning")
    .map((s: any) => s.id as string);

  const origin = new URL(request.url).origin;
  let next_user_session_id: string | null = null;

  if (identity.session_kind === "new") {
    for (const stage_id of learning_stage_ids) {
      const next_review_at = calcNextReviewAt(1, 0);
      await service_client
        .from("nv2_stage_progress")
        .update({
          review_status: "r1_pending",
          review_round: 1,
          next_review_at: next_review_at.toISOString(),
        })
        .eq("auth_user_id", auth_user_id)
        .eq("stage_id", stage_id)
        .eq("review_status", "none");
    }

    const next_product_session = await getNv2NextProductSession(
      client,
      product_session.product_id,
      product_session.session_number
    ).catch(() => null);

    if (next_product_session) {
      const next_session = await createNv2UserSession(
        service_client,
        auth_user_id,
        next_product_session.id
      ).catch(() => null);

      if (next_session) {
        next_user_session_id = String(next_session.session_id);
      }
    }

    const next_session_url = next_user_session_id
      ? `${origin}/sessions/${next_user_session_id}`
      : null;

    if (discord_id) {
      sendSessionCompleteDm(
        discord_id,
        next_session_url,
        product_name,
        product_session.session_number
      ).catch((err) => {
        console.error("[session-complete] sendSessionCompleteDm failed:", err);
      });
    }

  } else {
    const review_round = identity.review_round ?? 1;

    await advanceCronReviewProgress(
      service_client,
      auth_user_id,
      learning_stage_ids,
      review_round
    ).catch((err) => {
      console.error("[session-complete] advanceCronReviewProgress failed:", err);
    });

    if (discord_id) {
      sendSessionCompleteDm(
        discord_id,
        null,
        product_name,
        product_session.session_number,
        true  // is_review
      ).catch((err) => {
        console.error("[session-complete] review complete DM failed:", err);
      });
    }
  }

  return routeData({ ok: true, next_session_id: next_user_session_id, is_anonymous: false });
}
