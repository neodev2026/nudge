/**
 * POST /api/v2/sessions/:sessionId/complete
 *
 * Marks a session as completed.
 *
 * Behaviour differs by session_kind:
 *
 * kind = 'new':
 *   - Sets review_status = r1_pending + next_review_at = +1 day for all learning stages
 *   - Pre-creates the next new-learning session
 *   - Sends congratulation DM with next session link
 *
 * kind = 'review':
 *   - Advances review_status for all learning stages in the session
 *     (r1→r2, r2→r3, r3→r4, r4→mastered)
 *   - Sets next_review_at for non-mastered stages
 *   - Sends congratulation DM (no next session link)
 *
 * Response (JSON):
 *   { ok: true, next_session_id: string | null }
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/complete";

import makeServerClient from "~/core/lib/supa-client.server";
import {
  completeNv2UserSession,
  getNv2UserSession,
  getNv2ProductSessionWithStages,
  getNv2NextProductSession,
  createNv2UserSession,
} from "~/features/v2/session/lib/queries.server";
import { sendSessionCompleteDm } from "~/features/v2/auth/lib/discord.server";
import {
  advanceCronReviewProgress,
  calcNextReviewAt,
} from "~/features/v2/cron/lib/queries.server";
import type { SnsType } from "~/features/v2/shared/types";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client, headers] = makeServerClient(request);

  // ── Auth check ────────────────────────────────────────────────────────────
  const { data: session_data } = await client.auth.getSession();
  if (!session_data.session) {
    return routeData({ error: "Unauthorized" }, { status: 401, headers });
  }

  const auth_user = session_data.session.user;
  const meta = auth_user.user_metadata as Record<string, unknown>;
  const sns_id =
    (meta.provider_id as string | undefined) ??
    (meta.sub as string | undefined);

  if (!sns_id) {
    return routeData(
      { error: "Discord identity not found" },
      { status: 400, headers }
    );
  }

  const sns_type: SnsType = "discord";

  // ── Load user session ─────────────────────────────────────────────────────
  const user_session = await getNv2UserSession(
    client,
    params.sessionId
  ).catch(() => null);

  if (!user_session) {
    return routeData({ error: "Session not found" }, { status: 404, headers });
  }

  // ── Mark session completed ────────────────────────────────────────────────
  await completeNv2UserSession(client, params.sessionId);

  // ── Load product session ──────────────────────────────────────────────────
  const product_session = await getNv2ProductSessionWithStages(
    client,
    user_session.product_session_id
  ).catch(() => null);

  if (!product_session) {
    return routeData({ ok: true, next_session_id: null }, { headers });
  }

  // Learning stage IDs in this session (exclude quiz/welcome/congratulations)
  const learning_stage_ids = (
    product_session.nv2_product_session_stages ?? []
  )
    .map((s: any) => s.nv2_stages)
    .filter((s: any) => s?.stage_type === "learning")
    .map((s: any) => s.id as string);

  const origin = new URL(request.url).origin;
  let next_user_session_id: string | null = null;

  // ── Branch by session_kind ────────────────────────────────────────────────
  if (user_session.session_kind === "new") {
    // Schedule r1 review for all learning stages in this session
    for (const stage_id of learning_stage_ids) {
      const next_review_at = calcNextReviewAt(1, 0);
      await client
        .from("nv2_stage_progress")
        .update({
          review_status: "r1_pending",
          review_round: 1,
          next_review_at: next_review_at.toISOString(),
        })
        .eq("sns_type", sns_type)
        .eq("sns_id", sns_id)
        .eq("stage_id", stage_id)
        .eq("review_status", "none"); // Only update stages not yet scheduled
    }

    // Find and pre-create next new-learning session
    const next_product_session = await getNv2NextProductSession(
      client,
      product_session.product_id,
      product_session.session_number
    ).catch(() => null);

    if (next_product_session) {
      const next_session = await createNv2UserSession(
        client,
        sns_type,
        sns_id,
        next_product_session.id
      ).catch(() => null);

      if (next_session) {
        next_user_session_id = next_session.session_id;
      }
    }

    const next_session_url = next_user_session_id
      ? `${origin}/sessions/${next_user_session_id}`
      : null;

    sendSessionCompleteDm(sns_id, next_session_url).catch((err) => {
      console.error("[session-complete] sendSessionCompleteDm failed:", err);
    });

  } else {
    // Review session complete — advance review_status for all learning stages
    const review_round = user_session.review_round ?? 1;

    await advanceCronReviewProgress(
      client,
      sns_type,
      sns_id,
      learning_stage_ids,
      review_round
    ).catch((err) => {
      console.error("[session-complete] advanceCronReviewProgress failed:", err);
    });

    // No next session link for review — cron will send on the scheduled date
    sendSessionCompleteDm(sns_id, null).catch((err) => {
      console.error("[session-complete] review complete DM failed:", err);
    });
  }

  return routeData(
    { ok: true, next_session_id: next_user_session_id },
    { headers }
  );
}
