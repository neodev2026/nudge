/**
 * /products
 *
 * Product listing page shown after Discord OAuth onboarding.
 * Displays all active learning products from nv2_learning_products.
 *
 * Auth behaviour:
 *   - Accessible by both authenticated and anonymous users
 *   - Authenticated users see a personalised greeting and "Continue" CTA
 *   - Anonymous users see a "Start with Discord" CTA
 */
import type { Route } from "./+types/products-page";

import { Link, useLoaderData } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import {
  getNv2ActiveProducts,
  getNv2ProductsByCategory,
} from "~/features/v2/products/queries";
import type { NV2ProductMeta, LanguageMeta } from "~/features/v2/products/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Product = {
  id: string;
  category: "language" | "medical" | "exam" | "business" | "general";
  name: string;
  description: string | null;
  slug: string;
  icon: string | null;
  meta: NV2ProductMeta | null;
  total_stages: number;
  display_order: number;
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "학습 상품 — Nudge" },
  {
    name: "description",
    content: "Nudge에서 학습할 언어와 레벨을 선택하세요.",
  },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const [client, headers] = makeServerClient(request);

  // Fetch active products and current session in parallel
  const [products, { data: session_data }] = await Promise.all([
    getNv2ActiveProducts(client),
    client.auth.getSession(),
  ]);

  const auth_user = session_data.session?.user ?? null;

  // Extract display name from Supabase user metadata (set by Discord OAuth)
  const display_name =
    (auth_user?.user_metadata?.full_name as string | undefined) ??
    (auth_user?.user_metadata?.global_name as string | undefined) ??
    null;

  return { products, display_name, headers };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATEGORY_ICONS: Record<string, string> = {
  language: "📚",
  medical: "🩺",
  exam: "📝",
  business: "💼",
  general: "🎯",
};

/** Returns a short subtitle string from product.meta */
function getProductSubtitle(product: Product): string {
  const m =
    product.meta && typeof product.meta === "object" && !Array.isArray(product.meta)
      ? (product.meta as Record<string, unknown>)
      : {};

  if (product.category === "language") {
    const lang = typeof m.language === "string" ? m.language.toUpperCase() : "";
    const level = typeof m.level === "string" ? m.level : "";
    return [lang, level].filter(Boolean).join(" · ");
  }
  if (product.category === "exam") {
    return typeof m.exam_name === "string" ? m.exam_name : "";
  }
  if (product.category === "medical") {
    return typeof m.domain === "string" ? m.domain : "Medical";
  }
  return "";
}

/** Groups products by category, preserving display_order within each group */
function groupByCategory(products: Product[]): Map<string, Product[]> {
  const map = new Map<string, Product[]>();
  for (const p of products) {
    const group = map.get(p.category) ?? [];
    group.push(p);
    map.set(p.category, group);
  }
  return map;
}

const CATEGORY_LABELS: Record<string, string> = {
  language: "언어 학습",
  medical: "의학 용어",
  exam: "자격증 / 시험",
  business: "비즈니스",
  general: "기타",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProductsPage() {
  const { products, display_name } = useLoaderData<typeof loader>();
  const grouped = groupByCategory(products);

  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      {/* ── Header ── */}
      <div className="border-b border-[#1a2744]/[0.07] bg-white/60 px-6 py-10 backdrop-blur-sm md:px-10">
        <div className="mx-auto max-w-5xl">
          {display_name ? (
            <>
              <p className="mb-1 text-sm font-semibold text-[#4caf72]">
                환영합니다 👋
              </p>
              <h1 className="font-display text-3xl font-black text-[#1a2744]">
                {display_name} 님, 어떤 학습을 시작할까요?
              </h1>
            </>
          ) : (
            <>
              <p className="mb-1 text-sm font-semibold text-[#4caf72]">
                학습 상품
              </p>
              <h1 className="font-display text-3xl font-black text-[#1a2744]">
                어떤 학습을 시작할까요?
              </h1>
            </>
          )}
          <p className="mt-2 text-[#6b7a99]">
            상품을 선택하면 Discord로 학습 카드가 발송됩니다.
          </p>

          {/* CTA for anonymous users */}
          {!display_name && (
            <Link
              to="/auth/discord/start"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#5865F2] px-6 py-2.5 text-sm font-extrabold text-white shadow-[0_4px_16px_rgba(88,101,242,0.30)] transition-all hover:-translate-y-px"
            >
              <DiscordIcon />
              Discord로 시작하기
            </Link>
          )}
        </div>
      </div>

      {/* ── Product groups ── */}
      <div className="mx-auto max-w-5xl space-y-12 px-6 py-10 md:px-10">
        {grouped.size === 0 ? (
          <EmptyState />
        ) : (
          Array.from(grouped.entries()).map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-5 font-display text-lg font-extrabold text-[#1a2744]">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Product Card
// ---------------------------------------------------------------------------

function ProductCard({ product }: { product: Product }) {
  const icon = product.icon ?? CATEGORY_ICONS[product.category] ?? "📚";
  const subtitle = getProductSubtitle(product);

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col rounded-2xl border border-[#1a2744]/[0.08] bg-white p-6 shadow-[0_2px_12px_rgba(26,39,68,0.06)] transition-all hover:-translate-y-1 hover:shadow-[0_8px_28px_rgba(26,39,68,0.11)]"
    >
      {/* Icon */}
      <span className="mb-4 block text-3xl">{icon}</span>

      {/* Subtitle (EN · B1 / 정보처리기사 / etc.) */}
      {subtitle && (
        <p className="mb-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-[#6b7a99]">
          {subtitle}
        </p>
      )}

      {/* Name */}
      <h3 className="mb-2 font-display text-xl font-black leading-tight text-[#1a2744]">
        {product.name}
      </h3>

      {/* Description */}
      {product.description && (
        <p className="mb-4 line-clamp-2 text-sm leading-[1.7] text-[#6b7a99]">
          {product.description}
        </p>
      )}

      {/* Stage count */}
      {product.total_stages > 0 && (
        <p className="mt-auto text-xs text-[#6b7a99]/70">
          {product.total_stages.toLocaleString()}개 항목
        </p>
      )}

      <span className="mt-3 text-xs font-bold text-[#4caf72] transition-colors group-hover:text-[#1a2744]">
        학습 시작 →
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <span className="mb-4 text-5xl">📭</span>
      <h3 className="mb-2 font-display text-xl font-black text-[#1a2744]">
        준비 중인 상품이 없어요
      </h3>
      <p className="text-sm text-[#6b7a99]">
        곧 새로운 학습 상품이 출시될 예정입니다.
      </p>
      <Link
        to="/"
        className="mt-6 text-sm font-bold text-[#4caf72] hover:underline"
      >
        홈으로 돌아가기
      </Link>
    </div>
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
