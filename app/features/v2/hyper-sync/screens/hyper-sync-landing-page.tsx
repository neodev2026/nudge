/**
 * /hyper-sync — Hyper-Sync entry page.
 *
 * Anonymous access allowed; no login required. The page has two jobs:
 *   1. Explain what Hyper-Sync is and how the learning loop works.
 *   2. List the participating products (one card each) so the visitor can
 *      pick one. Picking a product navigates to /hyper-sync/products/:slug,
 *      which renders that product's mission list.
 *
 * The mission list itself is intentionally NOT rendered here — as content
 * grew, a single page listing every mission of every product became an
 * unusable scroll. See hyper-sync-spec §5.1.
 */
import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  getHyperSyncProductSummary,
  type HyperSyncProductSummary,
} from "../lib/queries.server";
import { HYPER_SYNC_PRODUCT_SLUGS, getProductSubtitle } from "../lib/products";
import { HyperSyncHeader } from "../components/hyper-sync-header";

export async function loader({ request }: LoaderFunctionArgs) {
  const [client] = makeServerClient(request);

  const {
    data: { user },
  } = await client.auth.getUser();

  // One lightweight summary per product (no mission list — see file header).
  const summaries = await Promise.all(
    HYPER_SYNC_PRODUCT_SLUGS.map((slug) =>
      getHyperSyncProductSummary(client as any, slug)
    )
  );

  return {
    products: summaries.filter(
      (s): s is HyperSyncProductSummary => s !== null
    ),
    isAuthenticated: !!user,
  };
}

export const meta = () => [
  { title: "Hyper-Sync — 고속 암기 + 복습으로 기억 유지" },
  {
    name: "description",
    content:
      "기술 영어와 독일어 표현을 3분 안에 점검하고 망각 곡선 기반 복습으로 기억을 굳혀보세요.",
  },
];

// "How it works" — the three steps of the Hyper-Sync learning loop.
const STEPS = [
  {
    n: "01",
    title: "3분 점검",
    body: "표현 카드를 보고 기억하는지 바로 판정합니다. 한 미션은 약 10개 표현, 3분이면 끝납니다.",
  },
  {
    n: "02",
    title: "다음 날 복습 알림",
    body: "기억하지 못한 표현은 다음 날 아침 Discord DM(또는 이메일)으로 다시 받습니다.",
  },
  {
    n: "03",
    title: "망각 곡선 복습",
    body: "복습을 통과할수록 다시 만나는 간격이 늘어나며 장기 기억으로 굳습니다.",
  },
];

export default function HyperSyncLandingPage() {
  const { products, isAuthenticated } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0]">
      <HyperSyncHeader subtitle="hyper-sync" isAuthenticated={isAuthenticated} />

      <main className="mx-auto w-full max-w-[680px] px-7 py-12">
        {/* ── Service intro ─────────────────────────────────────────────── */}
        <section className="mb-12">
          <h1 className="mb-3 font-mono text-2xl">Hyper-Sync</h1>
          <p className="text-sm leading-relaxed text-white/70">
            실무에서 자주 만나는 기술 영어·독일어 표현을 3분 안에 점검하고, 틀린
            표현을 망각 곡선 기반 복습으로 굳히는 경량 학습 루프입니다.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="flex gap-4 rounded-xl border border-white/10 bg-[#0e0e0e] px-5 py-4"
              >
                <span className="shrink-0 font-mono text-sm text-[#c8f564]">
                  {s.n}
                </span>
                <div>
                  <div className="mb-1 text-sm font-medium text-white/90">
                    {s.title}
                  </div>
                  <p className="text-xs leading-relaxed text-white/60">
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Product selection ─────────────────────────────────────────── */}
        <h2 className="mb-2 font-mono text-lg">학습 상품을 선택하세요</h2>
        <p className="mb-6 text-sm text-white/60">
          상품을 고르면 미션 목록으로 이동합니다
        </p>

        {products.length === 0 ? (
          <EmptyState message="아직 콘텐츠가 준비되지 않았어요. 곧 공개됩니다." />
        ) : (
          <div className="flex flex-col gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        <div className="mt-10 flex items-center gap-3 rounded-xl border border-white/10 bg-[#111111] px-5 py-4 text-xs leading-relaxed text-white/60">
          <span className="shrink-0 text-xl">💬</span>
          <span>
            로그인하면 틀린 표현을 다음 날 아침 Discord DM(또는 이메일)으로 받을
            수 있어요. 미션은 로그인 없이도 가능합니다.
          </span>
        </div>
      </main>
    </div>
  );
}

function ProductCard({ product }: { product: HyperSyncProductSummary }) {
  const subtitle = getProductSubtitle(product.category, product.meta);
  // Description block is hidden entirely when the product has none.
  const hasDescription =
    typeof product.description === "string" &&
    product.description.trim().length > 0;

  return (
    <Link
      to={`/hyper-sync/products/${product.slug}`}
      className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0e0e0e] px-5 py-4 transition hover:border-white/25"
    >
      {product.icon && (
        <span className="shrink-0 text-2xl">{product.icon}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="truncate text-[15px] font-medium text-white/90">
            {product.name}
          </h3>
          {subtitle && (
            <span className="shrink-0 font-mono text-[10px] tracking-[0.08em] text-white/40">
              {subtitle}
            </span>
          )}
        </div>
        {hasDescription && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/55">
            {product.description}
          </p>
        )}
        <div className="mt-2 font-mono text-[10px] tracking-wider text-[#c8f564]">
          미션 {product.missionCount}개
        </div>
      </div>
      <span className="shrink-0 text-white/30 transition group-hover:text-white/60">
        →
      </span>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 bg-[#111111] px-6 py-16 text-center">
      <span className="text-3xl">📦</span>
      <p className="text-sm text-white/60">{message}</p>
    </div>
  );
}
