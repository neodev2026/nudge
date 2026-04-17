/**
 * /products/:slug
 *
 * Product detail page.
 *
 * CTA buttons:
 *   "학습 시작" — branches based on auth + subscription state:
 *     - Not logged in          → /login?next=/products/:slug
 *     - Logged in + no sub     → /products/:slug/checkout
 *     - Logged in + subscribed → start-learning API → /sessions/:id
 *   "즉시 무료 체험" — goes directly to first stage (no login, no data saved)
 */
import type { Route } from "./+types/product-detail-page";

import { Link, useLoaderData, useFetcher } from "react-router";
import { useState, useEffect } from "react";

import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { getNv2ProductBySlug } from "~/features/v2/products/queries";
import { getNv2FirstStage } from "~/features/v2/stage/lib/queries.server";
import { getNv2FirstProductSession } from "~/features/v2/session/lib/queries.server";
import type { NV2ProductMeta } from "~/features/v2/products/schema";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = ({ matches }) => {
  const loader_data = matches.find(
    (m) => m?.id === "routes/products/:slug"
  )?.data as Awaited<ReturnType<typeof loader>> | undefined;

  return [
    { title: loader_data ? `${loader_data.product.name} — Nudge` : "Nudge" },
    {
      name: "description",
      content: loader_data?.product.description ?? "Nudge 학습 상품",
    },
  ];
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);

  const product = await getNv2ProductBySlug(client, { slug: params.slug });
  if (!product) throw new Response("Product not found", { status: 404 });

  const first_stage = await getNv2FirstStage(client, product.id).catch(() => null);
  const first_product_session = await getNv2FirstProductSession(client, product.id).catch(() => null);

  const { data: { user } } = await client.auth.getUser();
  const is_authenticated = !!user;

  // Check subscription if logged in
  let is_subscribed = false;
  if (user) {
    const { data: sub } = await adminClient
      .from("nv2_subscriptions")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("product_id", product.id)
      .eq("is_active", true)
      .maybeSingle();
    is_subscribed = !!sub;
  }

  return {
    product: {
      ...product,
      price: (product as any).price ?? 0,
    },
    first_stage,
    first_product_session,
    is_authenticated,
    is_subscribed,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProductSubtitle(category: string, meta: NV2ProductMeta | null): string {
  const m = meta && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
  if (category === "language") {
    const lang = typeof m.language === "string" ? m.language.toUpperCase() : "";
    const level = typeof m.level === "string" ? m.level : "";
    return [lang, level].filter(Boolean).join(" · ");
  }
  if (category === "exam") return typeof m.exam_name === "string" ? m.exam_name : "";
  if (category === "medical") return typeof m.domain === "string" ? m.domain : "Medical";
  return "";
}

const CATEGORY_ICONS: Record<string, string> = {
  language: "📚", medical: "🩺", exam: "📝", business: "💼", general: "🎯",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProductDetailPage() {
  const { product, first_stage, first_product_session, is_authenticated, is_subscribed } =
    useLoaderData<typeof loader>();

  const icon = product.icon ?? CATEGORY_ICONS[product.category] ?? "📚";
  const subtitle = getProductSubtitle(product.category, product.meta as NV2ProductMeta | null);

  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      {/* Back link */}
      <div className="border-b border-[#1a2744]/[0.07] bg-white/60 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl">
          <Link to="/products" className="text-sm font-semibold text-[#6b7a99] hover:text-[#1a2744]">
            ← 학습 상품
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-6 py-12">
        {/* Product header */}
        <div className="mb-10 rounded-3xl bg-white p-8 shadow-[0_4px_24px_rgba(26,39,68,0.08)]">
          <span className="mb-4 block text-5xl">{icon}</span>

          {subtitle && (
            <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
              {subtitle}
            </p>
          )}

          <h1 className="mb-3 font-display text-3xl font-black text-[#1a2744]">
            {product.name}
          </h1>

          {product.description && (
            <p className="mb-6 text-base leading-[1.8] text-[#6b7a99]">
              {product.description}
            </p>
          )}

          {/* Stats row */}
          <div className="mb-8 flex gap-8 border-t border-[#1a2744]/[0.06] pt-6">
            <div>
              <div className="font-display text-2xl font-black text-[#1a2744]">
                {product.total_stages.toLocaleString()}<span className="text-[#4caf72]">개</span>
              </div>
              <div className="mt-0.5 text-xs text-[#6b7a99]">학습 단계</div>
            </div>
            <div>
              <div className="font-display text-2xl font-black text-[#1a2744]">
                20<span className="text-[#4caf72]">초</span>
              </div>
              <div className="mt-0.5 text-xs text-[#6b7a99]">카드 1장 학습</div>
            </div>
            <div>
              <div className="font-display text-2xl font-black text-[#1a2744]">
                {product.price === 0 ? (
                  <>0<span className="text-[#4caf72]">원</span></>
                ) : (
                  <>{product.price.toLocaleString("ko-KR")}<span className="text-xs text-[#6b7a99] ml-1">원</span></>
                )}
              </div>
              <div className="mt-0.5 text-xs text-[#6b7a99]">
                {product.price === 0 ? "무료" : "가격"}
              </div>
            </div>
          </div>

          {/* CTA buttons */}
          <CTASection
            product_slug={product.slug}
            first_stage={first_stage}
            first_product_session={first_product_session}
            is_authenticated={is_authenticated}
            is_subscribed={is_subscribed}
          />
        </div>

        {/* How it works */}
        <div className="rounded-3xl bg-white p-8 shadow-[0_4px_24px_rgba(26,39,68,0.08)]">
          <h2 className="mb-6 font-display text-lg font-black text-[#1a2744]">학습 방법</h2>
          <div className="space-y-4">
            {[
              { num: "01", title: "카드 열람", desc: "단어, 의미, 예문 카드를 순서대로 확인합니다. 한 장에 20초면 충분해요." },
              { num: "02", title: "Self 평가", desc: "\"암기 완료\"를 누르면 다음 단계로 진행됩니다. 더 보고 싶으면 \"다시 보기\"를 눌러요." },
              { num: "03", title: "자동 복습", desc: "+1일, +3일, +7일, +14일에 복습 알림이 발송됩니다." },
            ].map(({ num, title, desc }) => (
              <div key={num} className="flex gap-4">
                <div className="font-display text-2xl font-black leading-none text-[#4caf72]/30">{num}</div>
                <div>
                  <h3 className="mb-1 font-display text-sm font-extrabold text-[#1a2744]">{title}</h3>
                  <p className="text-sm leading-[1.7] text-[#6b7a99]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CTASection
// ---------------------------------------------------------------------------

function CTASection({
  product_slug,
  first_stage,
  first_product_session,
  is_authenticated,
  is_subscribed,
}: {
  product_slug: string;
  first_stage: { id: string } | null;
  first_product_session: { id: string } | null;
  is_authenticated: boolean;
  is_subscribed: boolean;
}) {
  const [show_trial_modal, set_show_trial_modal] = useState(false);

  const fetcher = useFetcher<{ ok?: boolean; session_id?: string; error?: string }>();
  const is_loading = fetcher.state !== "idle";

  // Redirect after start-learning succeeds
  useEffect(() => {
    if (fetcher.data?.ok && fetcher.data.session_id) {
      window.location.href = `/sessions/${fetcher.data.session_id}`;
    }
  }, [fetcher.data]);

  if (!first_stage) {
    return (
      <div className="rounded-2xl bg-[#fdf8f0] px-5 py-4 text-center">
        <p className="text-sm font-bold text-[#6b7a99]">콘텐츠 준비 중이에요. 조금만 기다려주세요! 🛠️</p>
      </div>
    );
  }

  // If loading after start-learning
  if (fetcher.data?.ok) {
    return (
      <div className="rounded-2xl bg-[#4caf72]/10 px-5 py-5 text-center">
        <div className="mb-1 text-2xl">⏳</div>
        <p className="font-bold text-[#1a2744]">세션 페이지로 이동 중...</p>
      </div>
    );
  }

  function handleStartLearning() {
    if (!is_authenticated) {
      // Not logged in → login page
      window.location.href = `/login?next=${encodeURIComponent(`/products/${product_slug}`)}`;
      return;
    }
    if (!is_subscribed) {
      // Logged in but not subscribed → checkout
      window.location.href = `/products/${product_slug}/checkout`;
      return;
    }
    // Subscribed → call start-learning API
    fetcher.submit(
      {},
      { method: "POST", action: `/api/v2/products/${product_slug}/start` }
    );
  }

  return (
    <div className="space-y-3">
      {/* Primary: 학습 시작 */}
      <button
        onClick={handleStartLearning}
        disabled={is_loading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4caf72] py-4 text-base font-extrabold text-white shadow-[0_4px_16px_rgba(76,175,114,0.30)] transition-all hover:-translate-y-px hover:bg-[#5ecb87] disabled:opacity-60"
      >
        {is_loading ? "준비 중..." : is_subscribed ? "학습 시작 →" : is_authenticated ? "구매하고 학습 시작 →" : "로그인하고 학습 시작 →"}
      </button>

      {/* Secondary: 즉시 무료 체험 */}
      <button
        onClick={() => set_show_trial_modal(true)}
        className="w-full rounded-2xl border border-[#e8ecf5] bg-white py-3.5 text-sm font-bold text-[#6b7a99] transition-all hover:border-[#d0d7e8] hover:text-[#1a2744]"
      >
        즉시 무료 체험
      </button>

      {/* Error */}
      {fetcher.data?.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600 text-center">
          {fetcher.data.error}
        </p>
      )}

      {/* Trial modal */}
      {show_trial_modal && (
        <TrialModal
          product_slug={product_slug}
          onClose={() => set_show_trial_modal(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrialModal
// ---------------------------------------------------------------------------

function TrialModal({
  product_slug,
  onClose,
}: {
  product_slug: string;
  onClose: () => void;
}) {
  const fetcher = useFetcher<{ ok?: boolean; session_id?: string; error?: string }>();
  const is_loading = fetcher.state !== "idle";

  // Redirect after trial session created
  useEffect(() => {
    if (fetcher.data?.ok && fetcher.data.session_id) {
      window.location.href = `/sessions/${fetcher.data.session_id}`;
    }
  }, [fetcher.data]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-3xl text-center">✨</div>
        <h3 className="mb-2 text-center font-display text-xl font-black text-[#1a2744]">
          무료 체험
        </h3>
        <p className="mb-5 text-center text-sm leading-relaxed text-[#6b7a99]">
          로그인 없이 첫 번째 세션을 체험할 수 있어요.
          <br />
          <span className="font-bold text-[#f5a623]">학습 기록은 저장되지 않습니다.</span>
        </p>

        {fetcher.data?.error && (
          <p className="mb-3 text-center text-xs font-bold text-red-500">
            {fetcher.data.error}
          </p>
        )}

        <button
          onClick={() =>
            fetcher.submit(
              {},
              { method: "POST", action: `/api/v2/products/${product_slug}/trial` }
            )
          }
          disabled={is_loading}
          className="flex w-full items-center justify-center rounded-2xl bg-[#1a2744] py-3.5 text-sm font-extrabold text-white transition-all hover:bg-[#243358] disabled:opacity-60"
        >
          {is_loading ? "준비 중..." : "지금 바로 체험하기 →"}
        </button>

        <button
          onClick={onClose}
          className="mt-3 w-full rounded-2xl py-3 text-sm font-bold text-[#6b7a99] hover:text-[#1a2744]"
        >
          취소
        </button>
      </div>
    </div>
  );
}
