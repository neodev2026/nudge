/**
 * /admin/products
 *
 * Product management page.
 * Moved from /admin (dashboard) — contains product list and add button.
 */
import type { Route } from "./+types/products";
import { Link, useLoaderData } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import { adminGetAllProducts } from "~/features/admin/lib/queries.server";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "상품 관리 — Nudge Admin" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);
  const products = await adminGetAllProducts(client);
  return { products };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  language: "언어",
  medical:  "의학",
  exam:     "시험",
  business: "비즈니스",
  general:  "일반",
};

export default function AdminProducts() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black text-[#1a2744]">
            상품 관리
          </h1>
          <p className="mt-1 text-sm text-[#6b7a99]">
            총 {products.length}개 상품
          </p>
        </div>
        <Link
          to="/admin/products/new"
          className="rounded-xl bg-[#1a2744] px-5 py-2.5 text-sm font-extrabold text-white transition-all hover:bg-[#243358]"
        >
          + 상품 추가
        </Link>
      </div>

      {/* Product table */}
      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e8ecf5] py-16 text-center">
          <p className="text-sm text-[#6b7a99]">등록된 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e8ecf5] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e8ecf5] bg-[#f4f6fb]">
                {["상품명", "카테고리", "슬러그", "스테이지", "상태", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8ecf5]">
              {products.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-[#f4f6fb]">
                  <td className="px-5 py-4 font-semibold text-[#1a2744]">
                    {p.icon && <span className="mr-2">{p.icon}</span>}
                    {p.name}
                  </td>
                  <td className="px-5 py-4 text-[#6b7a99]">
                    {CATEGORY_LABELS[p.category] ?? p.category}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-[#6b7a99]">
                    {p.slug}
                  </td>
                  <td className="px-5 py-4 text-[#6b7a99]">
                    {p.total_stages.toLocaleString()}개
                  </td>
                  <td className="px-5 py-4">
                    <span className={[
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      p.is_active
                        ? "bg-[#4caf72]/10 text-[#4caf72]"
                        : "bg-[#e8ecf5] text-[#6b7a99]",
                    ].join(" ")}>
                      {p.is_active ? "활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      to={`/admin/products/${p.id}`}
                      className="rounded-lg border border-[#e8ecf5] px-3 py-1.5 text-xs font-bold text-[#1a2744] transition-colors hover:bg-[#1a2744] hover:text-white"
                    >
                      편집
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
