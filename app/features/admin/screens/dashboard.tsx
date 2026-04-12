/**
 * /admin
 *
 * Admin dashboard — lists all learning products.
 */
import type { Route } from "./+types/dashboard";

import { Link, useLoaderData, useFetcher } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import { adminGetAllProducts, adminGetUsersWithTurnBalance } from "~/features/admin/lib/queries.server";

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
  const users = await adminGetUsersWithTurnBalance(client);
  return { products, users };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  language: "언어",
  medical: "의학",
  exam: "시험",
  business: "비즈니스",
  general: "일반",
};

export default function AdminDashboard() {
  const { products, users } = useLoaderData<typeof loader>();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black text-[#1a2744]">
            학습 상품
          </h1>
          <p className="mt-1 text-sm text-[#6b7a99]">
            총 {products.length}개 상품
          </p>
        </div>
        <Link
          to="/admin/users"
          className="rounded-xl border border-[#e8ecf5] px-4 py-2 text-sm font-bold text-[#6b7a99] transition hover:bg-[#f4f6fb] hover:text-[#1a2744]"
        >
          👥 사용자 관리
        </Link>
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
                <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
                  상품명
                </th>
                <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
                  카테고리
                </th>
                <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
                  슬러그
                </th>
                <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
                  스테이지
                </th>
                <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
                  상태
                </th>
                <th className="px-5 py-3" />
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
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-bold",
                        p.is_active
                          ? "bg-[#4caf72]/10 text-[#4caf72]"
                          : "bg-[#e8ecf5] text-[#6b7a99]",
                      ].join(" ")}
                    >
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
      {/* ── Leni 채팅 턴 관리 ── */}
      <div className="mt-12">
        <h2 className="mb-4 font-display text-lg font-black text-[#1a2744]">
          Leni 채팅 턴 관리
        </h2>
        <div className="overflow-hidden rounded-2xl border border-[#e8ecf5] bg-white">
          <table className="w-full">
            <thead className="border-b border-[#e8ecf5] bg-[#f4f6fb]">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">사용자</th>
                <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">월정기권</th>
                <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">충전권</th>
                <th className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">합계</th>
                <th className="px-5 py-3 text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">지급</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8ecf5]">
              {users.map((u) => (
                <TurnRow key={u.auth_user_id} user={u} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TurnRow — per-user turn grant form
// ---------------------------------------------------------------------------

function TurnRow({ user }: {
  user: {
    auth_user_id: string;
    display_name: string | null;
    sns_type: string;
    sns_id: string;
    subscription_turns: number;
    charged_turns: number;
  };
}) {
  const fetcher = useFetcher();
  const total = user.subscription_turns + user.charged_turns;

  return (
    <tr className="transition-colors hover:bg-[#f4f6fb]">
      <td className="px-5 py-4">
        <p className="font-semibold text-[#1a2744]">{user.display_name ?? user.sns_id}</p>
        <p className="text-xs text-[#6b7a99]">{user.sns_type} · {user.sns_id}</p>
      </td>
      <td className="px-5 py-4 text-sm text-[#1a2744]">
        {user.subscription_turns.toLocaleString()}턴
      </td>
      <td className="px-5 py-4 text-sm text-[#1a2744]">
        {user.charged_turns.toLocaleString()}턴
      </td>
      <td className="px-5 py-4">
        <span className={[
          "rounded-full px-2.5 py-1 text-xs font-bold",
          total > 0 ? "bg-[#4caf72]/10 text-[#4caf72]" : "bg-red-50 text-red-500",
        ].join(" ")}>
          {total.toLocaleString()}턴
        </span>
      </td>
      <td className="px-5 py-4">
        <fetcher.Form method="post" action="/admin/api/turns/grant" className="flex items-center gap-2">
          <input type="hidden" name="auth_user_id" value={user.auth_user_id} />
          <input
            type="number"
            name="amount"
            defaultValue={500}
            min={1}
            max={10000}
            className="w-20 rounded-lg border border-[#e8ecf5] px-2 py-1 text-xs text-[#1a2744] focus:border-[#4caf72] focus:outline-none"
          />
          <select
            name="grant_type"
            className="rounded-lg border border-[#e8ecf5] px-2 py-1 text-xs text-[#1a2744] focus:border-[#4caf72] focus:outline-none"
          >
            <option value="charged">충전권</option>
            <option value="subscription">월정기권</option>
          </select>
          <button
            type="submit"
            disabled={fetcher.state !== "idle"}
            className="rounded-lg bg-[#1a2744] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#2a3a5c] disabled:opacity-50"
          >
            {fetcher.state !== "idle" ? "처리 중..." : "지급"}
          </button>
        </fetcher.Form>
      </td>
    </tr>
  );
}
