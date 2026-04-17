/**
 * POST /api/v2/products/:slug/purchase
 *
 * Handles product purchase.
 *   - price = 0  : instant approval → upsert nv2_subscriptions (source='free')
 *   - price > 0  : payment not yet implemented → return 'pending'
 *
 * Requires authentication.
 */
import type { Route } from "./+types/purchase";
import { data as routeData, redirect } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return routeData({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch product
  const { data: product } = await adminClient
    .from("nv2_learning_products")
    .select("id, name, price, slug")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!product) {
    return routeData({ error: "상품을 찾을 수 없습니다" }, { status: 404 });
  }

  const price = (product as any).price ?? 0;

  if (price > 0) {
    // Paid product — payment not yet implemented
    return routeData({ status: "payment_pending" }, { status: 200 });
  }

  // Free product — instant approval
  // Check if subscription already exists
  const { data: existing } = await adminClient
    .from("nv2_subscriptions")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("product_id", product.id)
    .maybeSingle();

  if (existing) {
    // Already subscribed — activate if inactive
    await adminClient
      .from("nv2_subscriptions")
      .update({ is_active: true })
      .eq("id", existing.id);
  } else {
    // New subscription
    const { error: insert_error } = await adminClient
      .from("nv2_subscriptions")
      .insert({
        auth_user_id: user.id,
        product_id: product.id,
        source: "free",
        is_active: true,
        started_at: new Date().toISOString(),
      });

    if (insert_error) {
      console.error("[purchase] insert subscription failed:", insert_error);
      return routeData({ error: "구매 처리 중 오류가 발생했습니다" }, { status: 500 });
    }
  }

  return routeData({ ok: true, product_slug: product.slug });
}
