/**
 * GET /products/:slug/checkout
 *
 * Checkout page — shows product info and price.
 *   price = 0  : "무료로 시작합니다" + "시작하기" button → purchase API → /sessions/:id
 *   price > 0  : "결제 준비 중입니다" notice (button disabled)
 *
 * Requires authentication. Redirects to /login if not authenticated.
 * Redirects to /products/:slug if already subscribed.
 */
import type { Route } from "./+types/checkout";
import { useLoaderData, useFetcher } from "react-router";
import { redirect } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { useEffect } from "react";

export const meta: Route.MetaFunction = () => [
  { title: "구매 — Nudge" },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(`/products/${params.slug}/checkout`);
    throw redirect(`/login?next=${next}`);
  }

  const { data: product } = await adminClient
    .from("nv2_learning_products")
    .select("id, name, slug, description, icon, meta, price")
    .eq("slug", params.slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!product) throw new Response("상품을 찾을 수 없습니다", { status: 404 });

  // Check if already subscribed
  const { data: existing } = await adminClient
    .from("nv2_subscriptions")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("product_id", product.id)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) {
    throw redirect(`/products/${params.slug}`);
  }

  return {
    product: {
      ...product,
      price: (product as any).price ?? 0,
    },
  };
}

export default function CheckoutPage() {
  const { product } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ ok?: boolean; status?: string; error?: string; product_slug?: string }>();
  const is_free = product.price === 0;
  const is_submitting = fetcher.state !== "idle";

  // Redirect to product page after successful purchase
  useEffect(() => {
    if (fetcher.data?.ok && fetcher.data.product_slug) {
      window.location.href = `/products/${fetcher.data.product_slug}`;
    }
  }, [fetcher.data]);

  function handlePurchase() {
    fetcher.submit(
      {},
      {
        method: "POST",
        action: `/api/v2/products/${product.slug}/purchase`,
      }
    );
  }

  const meta = product.meta as Record<string, string> | null;
  const level = meta?.level ?? null;
  const language_label = meta?.language
    ? { de: "독일어", es: "스페인어", ja: "일본어", en: "영어" }[meta.language] ?? meta.language
    : null;

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Product card */}
        <div className="mb-6 overflow-hidden rounded-3xl border border-[#e8ecf5] bg-white">
          {/* Product header */}
          <div className="bg-[#1a2744] px-6 py-8 text-center">
            <div className="mb-3 text-5xl">{product.icon ?? "📚"}</div>
            <h1 className="font-display text-2xl font-black text-white">
              {product.name}
            </h1>
            {(language_label || level) && (
              <p className="mt-1 text-sm text-white/60">
                {[language_label, level].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          {/* Product details */}
          <div className="px-6 py-5">
            {product.description && (
              <p className="mb-4 text-sm leading-relaxed text-[#6b7a99]">
                {product.description}
              </p>
            )}

            {/* Price row */}
            <div className="flex items-center justify-between rounded-2xl bg-[#f4f6fb] px-4 py-3">
              <span className="text-sm font-bold text-[#1a2744]">가격</span>
              {is_free ? (
                <span className="font-display text-xl font-black text-[#4caf72]">
                  무료
                </span>
              ) : (
                <span className="font-display text-xl font-black text-[#1a2744]">
                  {product.price.toLocaleString("ko-KR")}원
                </span>
              )}
            </div>

            {/* Free product notice */}
            {is_free && (
              <div className="mt-3 rounded-xl bg-[#4caf72]/10 border border-[#4caf72]/20 px-4 py-3">
                <p className="text-xs font-bold text-[#4caf72]">
                  ✓ 별도 결제 없이 바로 시작할 수 있어요
                </p>
              </div>
            )}

            {/* Paid product — coming soon */}
            {!is_free && (
              <div className="mt-3 rounded-xl bg-[#f5a623]/10 border border-[#f5a623]/20 px-4 py-3">
                <p className="text-xs font-bold text-[#f5a623]">
                  🚧 결제 기능 준비 중입니다. 곧 오픈해요!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Error message */}
        {fetcher.data?.error && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
            {fetcher.data.error}
          </p>
        )}

        {/* CTA button */}
        <button
          onClick={handlePurchase}
          disabled={!is_free || is_submitting}
          className={[
            "w-full rounded-2xl py-4 text-base font-extrabold transition-all",
            is_free && !is_submitting
              ? "bg-[#4caf72] text-white hover:-translate-y-px hover:bg-[#5ecb87] shadow-[0_4px_16px_rgba(76,175,114,0.30)]"
              : "cursor-not-allowed bg-[#e8ecf5] text-[#b0b8cc]",
          ].join(" ")}
        >
          {is_submitting
            ? "처리 중..."
            : is_free
            ? "무료로 시작하기 →"
            : "결제 준비 중"}
        </button>

        <button
          onClick={() => window.history.back()}
          className="mt-3 w-full rounded-2xl py-3 text-sm font-bold text-[#6b7a99] transition-colors hover:text-[#1a2744]"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}
