/**
 * POST /api/v2/products/:slug/start
 *
 * Called when an authenticated user taps "학습 시작" on the product detail page.
 *
 * Flow:
 *   1. Resolve the product by slug
 *   2. Find the first learning stage (stage_number = 1, stage_type = "learning")
 *   3. Send a Discord DM with the stage link to the user's sns_id
 *   4. Return { ok: true }
 *
 * Response (JSON):
 *   { ok: true }
 *
 * Error responses:
 *   401 — not authenticated
 *   404 — product or first stage not found
 *   500 — DM dispatch failed
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/start-learning";

import makeServerClient from "~/core/lib/supa-client.server";
import { getNv2ProductBySlug } from "~/features/v2/products/queries";
import { getNv2FirstStage } from "~/features/v2/stage/lib/queries.server";
import { sendStageDm } from "~/features/v2/auth/lib/discord.server";

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

  // Extract Discord sns_id from Supabase user metadata
  const sns_id =
    (meta.provider_id as string | undefined) ??
    (meta.sub as string | undefined);

  if (!sns_id) {
    return routeData({ error: "Discord identity not found" }, { status: 400, headers });
  }

  // ── Resolve product ───────────────────────────────────────────────────────
  const product = await getNv2ProductBySlug(client, { slug: params.slug }).catch(
    () => null
  );

  if (!product) {
    return routeData({ error: "Product not found" }, { status: 404, headers });
  }

  // ── Find first learning stage ─────────────────────────────────────────────
  const first_stage = await getNv2FirstStage(client, product.id).catch(
    () => null
  );

  if (!first_stage) {
    return routeData(
      { error: "No learning stages available yet" },
      { status: 404, headers }
    );
  }

  // ── Send Discord DM ───────────────────────────────────────────────────────
  const origin = new URL(request.url).origin;
  const stage_url = `${origin}/stages/${first_stage.id}`;

  try {
    await sendStageDm(sns_id, stage_url, first_stage.title);
  } catch (err) {
    console.error("[start-learning] sendStageDm failed:", err);
    return routeData(
      { error: "Failed to send Discord message" },
      { status: 500, headers }
    );
  }

  return routeData({ ok: true }, { headers });
}
