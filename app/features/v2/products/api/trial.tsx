/**
 * POST /api/v2/products/:slug/trial
 *
 * Creates an anonymous session for free trial access.
 * auth_user_id is set to 'anon:<uuid>' to distinguish from real users.
 * No authentication required.
 *
 * Response: { ok: true, session_id: string }
 */
import type { Route } from "./+types/trial";
import { data as routeData } from "react-router";
import adminClient from "~/core/lib/supa-admin-client.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  // Fetch product
  const { data: product } = await adminClient
    .from("nv2_learning_products")
    .select("id, slug")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!product) {
    return routeData({ error: "상품을 찾을 수 없습니다" }, { status: 404 });
  }

  // Get first product session
  const { data: first_session } = await adminClient
    .from("nv2_product_sessions")
    .select("id")
    .eq("product_id", product.id)
    .eq("is_active", true)
    .order("session_number", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!first_session) {
    return routeData({ error: "체험할 수 있는 세션이 없습니다" }, { status: 404 });
  }

  // Generate anonymous user ID — prefix 'anon:' distinguishes from real users
  const anon_id = `anon:${crypto.randomUUID()}`;

  const { data: new_session, error } = await adminClient
    .from("nv2_sessions")
    .insert({
      auth_user_id: anon_id,
      product_session_id: first_session.id,
      session_kind: "new",
      status: "pending",
    })
    .select("session_id")
    .single();

  if (error || !new_session) {
    console.error("[trial] insert session failed:", error);
    return routeData({ error: "체험 세션 생성 중 오류가 발생했습니다" }, { status: 500 });
  }

  return routeData({ ok: true, session_id: new_session.session_id });
}
