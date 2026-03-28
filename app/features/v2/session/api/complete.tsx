/**
 * POST /api/v2/sessions/:sessionId/complete
 *
 * Marks a session as completed and sends a congratulation DM
 * with a link to the next session (if one exists).
 *
 * Response (JSON):
 *   { ok: true, next_session_id: string | null }
 *
 * Error responses:
 *   401 — not authenticated
 *   404 — session not found
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

  // ── Load product session to find next ─────────────────────────────────────
  const product_session = await getNv2ProductSessionWithStages(
    client,
    user_session.product_session_id
  ).catch(() => null);

  if (!product_session) {
    return routeData({ ok: true, next_session_id: null }, { headers });
  }

  // ── Find next product session ─────────────────────────────────────────────
  const next_product_session = await getNv2NextProductSession(
    client,
    product_session.product_id,
    product_session.session_number
  ).catch(() => null);

  let next_user_session_id: string | null = null;

  if (next_product_session) {
    // Pre-create the next user session so the link is immediately usable
    const next_session = await createNv2UserSession(
      client,
      sns_type,
      sns_id,
      next_product_session.id
    ).catch(() => null);

    if (next_session) {
      next_user_session_id = String(next_session.session_id);
    }
  }

  // ── Send congratulation DM ────────────────────────────────────────────────
  const origin = new URL(request.url).origin;
  const next_session_url = next_user_session_id
    ? `${origin}/sessions/${next_user_session_id}`
    : null;

  sendSessionCompleteDm(sns_id, next_session_url).catch((err) => {
    // Non-fatal — log and continue
    console.error("[session-complete] sendSessionCompleteDm failed:", err);
  });

  return routeData(
    { ok: true, next_session_id: next_user_session_id },
    { headers }
  );
}
