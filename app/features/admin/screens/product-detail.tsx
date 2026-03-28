/**
 * /admin/products/:id
 *
 * Product detail page showing:
 *   - Product info (name, slug, active toggle)
 *   - Stage list with add/edit/delete
 *   - Session configuration
 */
import type { Route } from "./+types/product-detail";

import { Link, useLoaderData, useFetcher } from "react-router";
import { useState } from "react";

import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import {
  adminGetProductById,
  adminGetStagesByProduct,
  adminGetSessionsByProduct,
} from "~/features/admin/lib/queries.server";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = ({ matches }) => {
  const loader_data = matches.find(
    (m) => m?.id === "routes/admin/products/:id"
  )?.data as Awaited<ReturnType<typeof loader>> | undefined;
  return [{ title: loader_data ? `${loader_data.product.name} — Nudge Admin` : "Nudge Admin" }];
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const [product, stages, sessions] = await Promise.all([
    adminGetProductById(client, params.id),
    adminGetStagesByProduct(client, params.id),
    adminGetSessionsByProduct(client, params.id),
  ]);

  return { product, stages, sessions };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const STAGE_TYPE_LABELS: Record<string, string> = {
  welcome: "안내",
  learning: "학습",
  quiz_5: "퀴즈 (5)",
  quiz_10: "퀴즈 (10)",
  quiz_daily: "일일 퀴즈",
  quiz_final: "최종 퀴즈",
  congratulations: "축하",
};

export default function AdminProductDetail() {
  const { product, stages, sessions } = useLoaderData<typeof loader>();
  const delete_fetcher = useFetcher();
  const toggle_fetcher = useFetcher();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <Link
          to="/admin"
          className="text-sm font-semibold text-[#6b7a99] hover:text-[#1a2744]"
        >
          ← 상품 목록
        </Link>
        <span className="text-[#e8ecf5]">/</span>
        <h1 className="font-display text-2xl font-black text-[#1a2744]">
          {product.icon && <span className="mr-2">{product.icon}</span>}
          {product.name}
        </h1>
        <span
          className={[
            "rounded-full px-2.5 py-1 text-xs font-bold",
            product.is_active
              ? "bg-[#4caf72]/10 text-[#4caf72]"
              : "bg-[#e8ecf5] text-[#6b7a99]",
          ].join(" ")}
        >
          {product.is_active ? "활성" : "비활성"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {/* ── Stage list ── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-black text-[#1a2744]">
              스테이지 목록
              <span className="ml-2 text-sm font-normal text-[#6b7a99]">
                {stages.length}개
              </span>
            </h2>
            <Link
              to={`/admin/products/${product.id}/stages/new`}
              className="rounded-xl bg-[#1a2744] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#243358]"
            >
              + 스테이지 추가
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#e8ecf5] bg-white">
            {stages.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#6b7a99]">
                스테이지가 없습니다.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e8ecf5] bg-[#f4f6fb]">
                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">#</th>
                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">제목</th>
                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">타입</th>
                    <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">상태</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8ecf5]">
                  {stages.map((s) => (
                    <tr key={s.id} className="hover:bg-[#f4f6fb]">
                      <td className="px-4 py-3 font-mono text-xs text-[#6b7a99]">
                        {s.stage_number}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#1a2744]">
                        {s.title}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-lg bg-[#f4f6fb] px-2 py-0.5 text-xs font-bold text-[#6b7a99]">
                          {STAGE_TYPE_LABELS[s.stage_type] ?? s.stage_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-xs font-bold",
                            s.is_active
                              ? "bg-[#4caf72]/10 text-[#4caf72]"
                              : "bg-[#e8ecf5] text-[#6b7a99]",
                          ].join(" ")}
                        >
                          {s.is_active ? "활성" : "비활성"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/admin/products/${product.id}/stages/${s.id}`}
                            className="rounded-lg border border-[#e8ecf5] px-3 py-1 text-xs font-bold text-[#1a2744] hover:bg-[#1a2744] hover:text-white"
                          >
                            편집
                          </Link>
                          <delete_fetcher.Form
                            method="post"
                            action={`/admin/api/stages/${s.id}/delete`}
                            onSubmit={(e) => {
                              if (!confirm(`"${s.title}" 스테이지를 삭제할까요?`)) {
                                e.preventDefault();
                              }
                            }}
                          >
                            <button
                              type="submit"
                              className="rounded-lg border border-red-200 px-3 py-1 text-xs font-bold text-red-500 hover:bg-red-50"
                            >
                              삭제
                            </button>
                          </delete_fetcher.Form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── Session config ── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-black text-[#1a2744]">
              세션 구성
              <span className="ml-2 text-sm font-normal text-[#6b7a99]">
                {sessions.length}개
              </span>
            </h2>
            <Link
              to={`/admin/products/${product.id}/sessions/new`}
              className="rounded-xl bg-[#4caf72] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5ecb87]"
            >
              + 세션 추가
            </Link>
          </div>

          <div className="space-y-3">
            {sessions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#e8ecf5] py-10 text-center text-sm text-[#6b7a99]">
                세션이 없습니다.
              </div>
            ) : (
              sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  product_id={product.id}
                  all_stages={stages}
                />
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SessionCard
// ---------------------------------------------------------------------------

function SessionCard({
  session,
  product_id,
  all_stages,
}: {
  session: any;
  product_id: string;
  all_stages: any[];
}) {
  const [is_open, set_is_open] = useState(false);
  const stages = session.nv2_product_session_stages ?? [];

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e8ecf5] bg-white">
      {/* Session header */}
      <div
        className="flex cursor-pointer items-center justify-between px-5 py-4 hover:bg-[#f4f6fb]"
        onClick={() => set_is_open((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-black text-[#6b7a99]">
            #{session.session_number}
          </span>
          <span className="font-semibold text-[#1a2744]">
            {session.title ?? `Session ${session.session_number}`}
          </span>
          <span className="text-xs text-[#6b7a99]">
            {stages.length}개 스테이지
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={[
              "rounded-full px-2 py-0.5 text-xs font-bold",
              session.is_active
                ? "bg-[#4caf72]/10 text-[#4caf72]"
                : "bg-[#e8ecf5] text-[#6b7a99]",
            ].join(" ")}
          >
            {session.is_active ? "활성" : "비활성"}
          </span>
          <span className="text-[#6b7a99]">{is_open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Session stages */}
      {is_open && (
        <div className="border-t border-[#e8ecf5] px-5 py-4">
          {stages.length === 0 ? (
            <p className="text-sm text-[#6b7a99]">스테이지가 없습니다.</p>
          ) : (
            <ol className="space-y-1">
              {stages
                .sort((a: any, b: any) => a.display_order - b.display_order)
                .map((s: any) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 text-xs text-[#6b7a99]">
                      {s.display_order}.
                    </span>
                    <span className="font-semibold text-[#1a2744]">
                      {s.nv2_stages?.title}
                    </span>
                    <span className="rounded bg-[#f4f6fb] px-1.5 py-0.5 text-xs text-[#6b7a99]">
                      {STAGE_TYPE_LABELS[s.nv2_stages?.stage_type] ?? ""}
                    </span>
                  </li>
                ))}
            </ol>
          )}
          <div className="mt-4 flex gap-2">
            <Link
              to={`/admin/products/${product_id}/sessions/${session.id}`}
              className="rounded-lg border border-[#e8ecf5] px-3 py-1.5 text-xs font-bold text-[#1a2744] hover:bg-[#1a2744] hover:text-white"
            >
              세션 편집
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
