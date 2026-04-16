/**
 * /products/:slug
 *
 * Product detail page.
 * Shows product info and a "학습 시작" button that redirects
 * directly to the first learning stage (no cron involvement).
 *
 * If the product has no active stages yet, shows a coming-soon state.
 */
import type { Route } from "./+types/product-detail-page";

import { Link, useLoaderData, useFetcher } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import { getNv2ProductBySlug } from "~/features/v2/products/queries";
import { getNv2FirstStage } from "~/features/v2/stage/lib/queries.server";
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
  const [client, headers] = makeServerClient(request);

  const product = await getNv2ProductBySlug(client, { slug: params.slug });

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  const first_stage = await getNv2FirstStage(client, product.id).catch(
    () => null
  );

  const { data: { user: auth_user } } = await client.auth.getUser();
  const is_authenticated = !!auth_user;

  return { product, first_stage, is_authenticated, headers };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProductSubtitle(
  category: string,
  meta: NV2ProductMeta | null
): string {
  const m =
    meta && typeof meta === "object" && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : {};

  if (category === "language") {
    const lang = typeof m.language === "string" ? m.language.toUpperCase() : "";
    const level = typeof m.level === "string" ? m.level : "";
    return [lang, level].filter(Boolean).join(" · ");
  }
  if (category === "exam") {
    return typeof m.exam_name === "string" ? m.exam_name : "";
  }
  if (category === "medical") {
    return typeof m.domain === "string" ? m.domain : "Medical";
  }
  return "";
}

const CATEGORY_ICONS: Record<string, string> = {
  language: "📚",
  medical: "🩺",
  exam: "📝",
  business: "💼",
  general: "🎯",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProductDetailPage() {
  const { product, first_stage, is_authenticated } =
    useLoaderData<typeof loader>();

  const icon = product.icon ?? CATEGORY_ICONS[product.category] ?? "📚";
  const subtitle = getProductSubtitle(
    product.category,
    product.meta as NV2ProductMeta | null
  );

  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      {/* Back link */}
      <div className="border-b border-[#1a2744]/[0.07] bg-white/60 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl">
          <Link
            to="/products"
            className="text-sm font-semibold text-[#6b7a99] hover:text-[#1a2744]"
          >
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
                {product.total_stages.toLocaleString()}
                <span className="text-[#4caf72]">개</span>
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
                0<span className="text-[#4caf72]">원</span>
              </div>
              <div className="mt-0.5 text-xs text-[#6b7a99]">무료 시작</div>
            </div>
          </div>

          {/* CTA */}
          <StartButton
            product_slug={product.slug}
            first_stage={first_stage}
            is_authenticated={is_authenticated}
          />
        </div>

        {/* How it works */}
        <div className="rounded-3xl bg-white p-8 shadow-[0_4px_24px_rgba(26,39,68,0.08)]">
          <h2 className="mb-6 font-display text-lg font-black text-[#1a2744]">
            학습 방법
          </h2>
          <div className="space-y-4">
            {[
              {
                num: "01",
                title: "카드 열람",
                desc: "단어, 의미, 예문 카드를 순서대로 확인합니다. 한 장에 20초면 충분해요.",
              },
              {
                num: "02",
                title: "Self 평가",
                desc: "\"암기 완료\"를 누르면 다음 단계로 진행됩니다. 더 보고 싶으면 \"다시 보기\"를 눌러요.",
              },
              {
                num: "03",
                title: "자동 복습",
                desc: "완료 후 +1일, +3일, +7일, +14일에 Discord로 복습 카드가 자동 발송됩니다.",
              },
            ].map(({ num, title, desc }) => (
              <div key={num} className="flex gap-4">
                <div className="font-display text-2xl font-black leading-none text-[#4caf72]/30">
                  {num}
                </div>
                <div>
                  <h3 className="mb-1 font-display text-sm font-extrabold text-[#1a2744]">
                    {title}
                  </h3>
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
// StartButton
// ---------------------------------------------------------------------------

function StartButton({
  product_slug,
  first_stage,
  is_authenticated,
}: {
  product_slug: string;
  first_stage: { id: string } | null;
  is_authenticated: boolean;
}) {
  const fetcher = useFetcher<{
    ok?: boolean;
    error?: string;
    session_id?: string;
    dm_sent?: boolean;
  }>();
  const is_sending = fetcher.state !== "idle";
  const result = fetcher.data;

  // Redirect to session page whenever ok=true (regardless of dm_sent)
  // DM failure is non-fatal — the session URL is valid either way.
  if (result?.ok && result.session_id) {
    window.location.href = `/sessions/${result.session_id}`;
  }

  // No stages yet
  if (!first_stage) {
    return (
      <div className="rounded-2xl bg-[#fdf8f0] px-5 py-4 text-center">
        <p className="text-sm font-bold text-[#6b7a99]">
          콘텐츠 준비 중이에요. 조금만 기다려주세요! 🛠️
        </p>
      </div>
    );
  }

  // Not logged in — prompt Discord auth
  if (!is_authenticated) {
    return (
      <div className="space-y-3">
        <Link
          to={`/auth/discord/start?next=${encodeURIComponent(`/products/${product_slug}`)}`}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5865F2] py-4 text-base font-extrabold text-white shadow-[0_4px_16px_rgba(88,101,242,0.25)] transition-all hover:-translate-y-px"
        >
          <DiscordIcon />
          Discord로 시작하기
        </Link>
        <p className="text-center text-xs text-[#6b7a99]">
          로그인 없이도 카드를 볼 수 있어요 —{" "}
          <Link
            to={`/stages/${first_stage.id}`}
            className="font-bold text-[#4caf72] hover:underline"
          >
            미리 보기
          </Link>
        </p>
      </div>
    );
  }

  // ok=true — redirect is handled above; show loading state while navigating
  if (result?.ok) {
    return (
      <div className="rounded-2xl bg-[#4caf72]/10 px-5 py-5 text-center">
        <div className="mb-1 text-2xl">⏳</div>
        <p className="font-bold text-[#1a2744]">세션 페이지로 이동 중...</p>
      </div>
    );
  }

  // Hard error — only non-DM errors reach here (product not found, 401, etc.)
  if (result?.error) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-red-50 px-5 py-4 text-center">
          <p className="text-sm font-bold text-red-600">
            오류가 발생했어요. 잠시 후 다시 시도해주세요.
          </p>
        </div>
        <button
          onClick={() =>
            fetcher.submit(
              {},
              { method: "POST", action: `/api/v2/products/${product_slug}/start` }
            )
          }
          className="w-full rounded-2xl bg-[#4caf72] py-4 text-base font-extrabold text-white transition-all hover:bg-[#5ecb87]"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // Logged in — default state
  return (
    <button
      disabled={is_sending}
      onClick={() =>
        fetcher.submit(
          {},
          { method: "POST", action: `/api/v2/products/${product_slug}/start` }
        )
      }
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4caf72] py-4 text-base font-extrabold text-white shadow-[0_4px_16px_rgba(76,175,114,0.30)] transition-all hover:-translate-y-px hover:bg-[#5ecb87] disabled:opacity-60"
    >
      {is_sending ? "준비 중..." : "학습 시작 — Discord로 카드 받기 📬"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.037.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}
