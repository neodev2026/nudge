/**
 * /my-learning
 *
 * My Learning Management — subscribed products list.
 *
 * Shows all active subscriptions for the logged-in user.
 * Each product card links to /products/:slug/progress.
 *
 * Auth: login required. Redirects to /login if not authenticated.
 */
import { redirect, useLoaderData, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: LoaderFunctionArgs) {
  const { createClient: createSupabase } = await import("@supabase/supabase-js");
  const adminClient = createSupabase(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Auth check
  const [client] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw redirect("/login?next=" + encodeURIComponent("/my-learning"));
  }

  // Fetch subscriptions joined with product info
  const { data: subs_raw } = await adminClient
    .from("nv2_subscriptions")
    .select(`
      id,
      is_active,
      source,
      started_at,
      nv2_learning_products!inner(
        id, name, slug, icon, category, meta, total_stages, description
      )
    `)
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .order("started_at", { ascending: true });

  type ProductRow = {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    category: string;
    meta: unknown;
    total_stages: number;
    description: string | null;
  };

  const subscriptions = (subs_raw ?? []).map((s) => {
    // Supabase !inner join returns the related row as an object (not array)
    // but the generated type infers it as array — cast via unknown to resolve
    const product = (s.nv2_learning_products as unknown) as ProductRow;
    return {
      sub_id: s.id,
      source: s.source,
      started_at: s.started_at ?? null,
      product,
    };
  });

  // Per-product: completed new sessions count
  const product_ids = subscriptions.map((s) => s.product.id);

  let completed_map: Record<string, number> = {};
  if (product_ids.length > 0) {
    const { data: sessions_raw } = await adminClient
      .from("nv2_sessions")
      .select("product_session_id, nv2_product_sessions!inner(product_id)")
      .eq("auth_user_id", user.id)
      .eq("status", "completed")
      .eq("session_kind", "new")
      .in("nv2_product_sessions.product_id", product_ids);

    for (const s of sessions_raw ?? []) {
      const pid = (s.nv2_product_sessions as any)?.product_id as string;
      if (pid) completed_map[pid] = (completed_map[pid] ?? 0) + 1;
    }
  }

  const items = subscriptions.map((s) => ({
    ...s,
    completed_sessions: completed_map[s.product.id] ?? 0,
  }));

  return { items };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProductSubtitle(product: {
  category: string;
  meta: unknown;
}): string {
  const m =
    product.meta && typeof product.meta === "object" && !Array.isArray(product.meta)
      ? (product.meta as Record<string, unknown>)
      : {};
  if (product.category === "language") {
    const lang = typeof m.language === "string" ? m.language.toUpperCase() : "";
    const level = typeof m.level === "string" ? m.level : "";
    return [lang, level].filter(Boolean).join(" · ");
  }
  if (product.category === "exam") return typeof m.exam_name === "string" ? m.exam_name : "";
  if (product.category === "medical") return typeof m.domain === "string" ? m.domain : "Medical";
  return "";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MyLearningPage() {
  const { items } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-black text-[#1a2744]">
          나의 학습 관리
        </h1>
        <p className="mt-1 text-sm text-[#6b7a99]">
          구독 중인 학습 상품의 진행 현황을 확인하세요.
        </p>
      </div>

      {items.length === 0 ? (
        /* Empty state */
        <div className="rounded-3xl bg-white p-12 text-center shadow-[0_4px_24px_rgba(26,39,68,0.08)]">
          <p className="mb-2 text-4xl">📚</p>
          <p className="mb-1 font-display text-base font-black text-[#1a2744]">
            구독 중인 상품이 없어요
          </p>
          <p className="mb-6 text-sm text-[#6b7a99]">
            학습 상품을 구독하면 이 곳에서 진행 현황을 확인할 수 있습니다.
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 rounded-full bg-[#1a2744] px-6 py-2.5 text-sm font-extrabold text-white transition-all hover:bg-[#243358]"
          >
            학습 상품 보러가기 →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const { product, completed_sessions } = item;
            const pct =
              product.total_stages > 0
                ? Math.round((completed_sessions / product.total_stages) * 100)
                : 0;
            // total_stages = stages count; sessions = stages / 5 (approx)
            const total_sessions = product.total_stages > 0
              ? Math.ceil(product.total_stages / 5)
              : 0;
            const subtitle = getProductSubtitle(product);

            return (
              <Link
                key={item.sub_id}
                to={`/products/${product.slug}/progress`}
                className="group flex items-center gap-5 rounded-3xl bg-white p-5 shadow-[0_4px_24px_rgba(26,39,68,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(26,39,68,0.12)]"
              >
                {/* Icon */}
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fdf8f0] text-3xl">
                  {product.icon ?? "📚"}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {subtitle && (
                    <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#9aa3b5]">
                      {subtitle}
                    </p>
                  )}
                  <p className="font-display text-base font-black text-[#1a2744] truncate">
                    {product.name}
                  </p>

                  {/* Progress bar */}
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#e8ecf5]">
                    <div
                      className="h-full rounded-full bg-[#4caf72] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-[#9aa3b5]">
                      {completed_sessions} / {total_sessions} 세션
                    </span>
                    <span className="text-[10px] font-bold text-[#4caf72]">
                      {pct}%
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <span className="text-[#c3c9d5] transition-colors group-hover:text-[#1a2744]">
                  →
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
