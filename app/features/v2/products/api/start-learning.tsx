/**
 * POST /api/v2/products/:slug/start
 *
 * Called when an authenticated user taps "학습 시작" on the product detail page.
 *
 * Flow:
 *   1. Resolve the product by slug
 *   2. Check if user has an active (pending/in_progress) session for this product
 *      → Active session exists : reuse it (send DM again, return session_id)
 *      → No active session     : find next product_session → create nv2_sessions row
 *   3. Send Discord DM with session link
 *   4. Return { ok: true, session_id } for client-side redirect
 *
 * Response (JSON):
 *   { ok: true, session_id: string }
 *
 * Error responses:
 *   401 — not authenticated
 *   404 — product not found / no sessions configured
 *   500 — DM dispatch failed
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/start-learning";

import makeServerClient from "~/core/lib/supa-client.server";
import { getNv2ProductBySlug } from "~/features/v2/products/queries";
import {
  getNv2ActiveUserSession,
  getNv2NextUnstartedProductSession,
  getNv2ProductSessionWithStages,
  createNv2UserSession,
  upsertNv2Subscription,
} from "~/features/v2/session/lib/queries.server";
import { sendSessionDm } from "~/features/v2/auth/lib/discord.server";
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

  // ── Resolve product ───────────────────────────────────────────────────────
  const product = await getNv2ProductBySlug(client, {
    slug: params.slug,
  }).catch(() => null);

  if (!product) {
    return routeData({ error: "Product not found" }, { status: 404, headers });
  }

  // ── Upsert subscription (creates if not exists, preserves existing settings) ──
  await upsertNv2Subscription(client, sns_type, sns_id, product.id).catch(
    (err) => console.error("[start-learning] upsertNv2Subscription failed:", err)
  );

  // ── Check for existing active session ─────────────────────────────────────
  let user_session_id: string;
  let product_session_id: string;

  const active_session = await getNv2ActiveUserSession(
    client,
    sns_type,
    sns_id,
    product.id
  ).catch(() => null);

  if (active_session) {
    // Reuse existing session — send DM again
    user_session_id = active_session.session_id as string;
    product_session_id = active_session.product_session_id;
  } else {
    // Find the next product session the user has not yet completed
    const next_product_session = await getNv2NextUnstartedProductSession(
      client,
      sns_type,
      sns_id,
      product.id
    ).catch(() => null);

    if (!next_product_session) {
      return routeData(
        { error: "No sessions configured for this product yet" },
        { status: 404, headers }
      );
    }

    product_session_id = next_product_session.id;

    // Create new user session
    const new_session = await createNv2UserSession(
      client,
      sns_type,
      sns_id,
      product_session_id
    );

    user_session_id = new_session.session_id as string;
  }

  // ── Fetch session details for DM ──────────────────────────────────────────
  const product_session = await getNv2ProductSessionWithStages(
    client,
    product_session_id
  ).catch(() => null);

  if (!product_session) {
    return routeData(
      { error: "Session details not found" },
      { status: 404, headers }
    );
  }

  const stage_count = product_session.nv2_product_session_stages?.length ?? 0;
  const session_title =
    product_session.title ?? `Session ${product_session.session_number}`;

  // ── Send Discord DM ───────────────────────────────────────────────────────
  const origin = new URL(request.url).origin;
  const session_url = `${origin}/sessions/${user_session_id}`;

  try {
    await sendSessionDm(sns_id, session_url, session_title, stage_count);
  } catch (err) {
    console.error("[start-learning] sendSessionDm failed:", err);
    return routeData(
      { error: "Failed to send Discord message" },
      { status: 500, headers }
    );
  }

  // Return session_id so the client can redirect immediately
  return routeData({ ok: true, session_id: user_session_id }, { headers });
}
