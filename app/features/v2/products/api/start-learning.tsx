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
 *   3. Attempt to send Discord DM with session link
 *      → DM success: { ok: true, session_id }
 *      → DM failure: log the error and still return { ok: true, session_id }
 *        The session URL is valid — the user can study without the DM.
 *        Error 50278 (no mutual guild) is the most common cause; the user
 *        can still access the session by navigating directly.
 *
 * Response (JSON):
 *   { ok: true, session_id: string, dm_sent: boolean }
 *
 * Error responses:
 *   401 — not authenticated
 *   404 — product not found / no sessions configured
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/start-learning";

import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { getNv2ProductBySlug } from "~/features/v2/products/queries";
import {
  getNv2ActiveUserSession,
  getNv2NextUnstartedProductSession,
  getNv2ProductSessionWithStages,
  createNv2UserSession,
  upsertNv2Subscription,
} from "~/features/v2/session/lib/queries.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client, headers] = makeServerClient(request);

  // ── Auth check ────────────────────────────────────────────────────────────
  const { data: { user: auth_user } } = await client.auth.getUser();
  if (!auth_user) {
    return routeData({ error: "Unauthorized" }, { status: 401, headers });
  }

  const auth_user_id = auth_user.id;

  // ── Resolve product ───────────────────────────────────────────────────────
  const product = await getNv2ProductBySlug(client, {
    slug: params.slug,
  }).catch(() => null);

  if (!product) {
    return routeData({ error: "Product not found" }, { status: 404, headers });
  }

  // ── Upsert subscription (uses adminClient to bypass RLS insert restriction) ──
  await upsertNv2Subscription(adminClient, auth_user_id, product.id).catch(
    (err) => console.error("[start-learning] upsertNv2Subscription failed:", err)
  );

  // ── Check for existing active session ─────────────────────────────────────
  let user_session_id: string;
  let product_session_id: string;

  const active_session = await getNv2ActiveUserSession(
    client,
    auth_user_id,
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
      auth_user_id,
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
      auth_user_id,
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

  // session_title kept for future use (e.g. email notification)
  // const session_title = product_session.title ?? `Session ${product_session.session_number}`;

  // ── Attempt Discord DM (non-blocking) ─────────────────────────────────────
  // DM failure (e.g. error 50278 — no mutual guild) must NOT block the user
  // from studying. The session URL is valid regardless of DM delivery.
  // The user will be redirected to /sessions/:id either way.
  const origin = new URL(request.url).origin;
  const session_url = `${origin}/sessions/${user_session_id}`;

  // DM delivery is handled exclusively by Cron (enqueue-daily / dispatch).
  // start-learning only creates the session and returns the URL.
  return routeData({ ok: true, session_id: user_session_id }, { headers });
}
