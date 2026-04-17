/**
 * /admin/trial-sessions
 *
 * Admin page for managing anonymous trial sessions.
 * Lists sessions where auth_user_id LIKE 'anon:%'.
 * Provides bulk delete functionality.
 */
import type { Route } from "./+types/trial-sessions";
import { useLoaderData, useFetcher, Link } from "react-router";
import { useState } from "react";
import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";

export const meta: Route.MetaFunction = () => [
  { title: "체험 세션 관리 — Nudge Admin" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const { data: sessions } = await adminClient
    .from("nv2_sessions")
    .select(`
      session_id,
      auth_user_id,
      status,
      created_at,
      nv2_product_sessions!inner(
        session_number,
        nv2_learning_products!inner(name, slug)
      )
    `)
    .like("auth_user_id", "anon:%")
    .order("created_at", { ascending: false })
    .limit(200);

  return { sessions: sessions ?? [] };
}

// ---------------------------------------------------------------------------
// Action — bulk delete
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const body = await request.json().catch(() => ({}));
  const { session_ids, delete_all } = body as {
    session_ids?: string[];
    delete_all?: boolean;
  };

  if (delete_all) {
    const { data, error } = await adminClient
      .from("nv2_sessions")
      .delete()
      .like("auth_user_id", "anon:%")
      .select("session_id");

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, deleted: data?.length ?? 0 });
  }

  if (session_ids?.length) {
    const { data, error } = await adminClient
      .from("nv2_sessions")
      .delete()
      .in("session_id", session_ids)
      .like("auth_user_id", "anon:%")
      .select("session_id");

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, deleted: data?.length ?? 0 });
  }

  return Response.json({ error: "No sessions specified" }, { status: 400 });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TrialSessionsPage() {
  const { sessions } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ ok?: boolean; deleted?: number; error?: string }>();
  const [selected, set_selected] = useState<Set<string>>(new Set());
  const is_submitting = fetcher.state !== "idle";

  // Refresh after delete
  const effective_sessions = fetcher.data?.ok ? [] : sessions;

  function toggleSelect(id: string) {
    set_selected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === effective_sessions.length) {
      set_selected(new Set());
    } else {
      set_selected(new Set(effective_sessions.map((s) => s.session_id)));
    }
  }

  function handleDeleteSelected() {
    if (!selected.size) return;
    fetcher.submit(
      JSON.stringify({ session_ids: Array.from(selected) }),
      { method: "POST", encType: "application/json" }
    );
    set_selected(new Set());
  }

  function handleDeleteAll() {
    if (!window.confirm(`전체 ${effective_sessions.length}건을 삭제하시겠습니까?`)) return;
    fetcher.submit(
      JSON.stringify({ delete_all: true }),
      { method: "POST", encType: "application/json" }
    );
    set_selected(new Set());
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="text-sm font-semibold text-[#6b7a99] hover:text-[#1a2744]"
          >
            ← 대시보드
          </Link>
          <div>
            <h1 className="font-display text-2xl font-black text-[#1a2744]">
              체험 세션 관리
            </h1>
            <p className="mt-0.5 text-sm text-[#6b7a99]">
              익명 무료 체험 세션 — 총 {effective_sessions.length}건 (7일 후 자동 삭제)
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {selected.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={is_submitting}
              className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              선택 삭제 ({selected.size}건)
            </button>
          )}
          {effective_sessions.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={is_submitting}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
            >
              전체 삭제
            </button>
          )}
        </div>
      </div>

      {/* Result toast */}
      {fetcher.data?.ok && (
        <div className="mb-4 rounded-xl bg-[#4caf72]/10 border border-[#4caf72]/30 px-4 py-3 text-sm font-bold text-[#4caf72]">
          ✅ {fetcher.data.deleted}건 삭제 완료
        </div>
      )}
      {fetcher.data?.error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          {fetcher.data.error}
        </div>
      )}

      {/* Table */}
      {effective_sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e8ecf5] py-16 text-center">
          <p className="text-sm text-[#6b7a99]">체험 세션이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e8ecf5] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e8ecf5] bg-[#f4f6fb]">
                <th className="w-12 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selected.size === effective_sessions.length && effective_sessions.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-[#e8ecf5]"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
                  세션 ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
                  상품
                </th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
                  생성일
                </th>
              </tr>
            </thead>
            <tbody>
              {effective_sessions.map((s) => {
                const ps = (s as any).nv2_product_sessions;
                const product = ps?.nv2_learning_products;
                return (
                  <tr
                    key={s.session_id}
                    className={[
                      "border-b border-[#e8ecf5] transition-colors hover:bg-[#f4f6fb]",
                      selected.has(s.session_id) ? "bg-[#f4f6fb]" : "",
                    ].join(" ")}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(s.session_id)}
                        onChange={() => toggleSelect(s.session_id)}
                        className="h-4 w-4 rounded border-[#e8ecf5]"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#6b7a99]">
                      {s.session_id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#1a2744]">
                      {product?.name ?? "—"}
                      {ps?.session_number ? (
                        <span className="ml-1 text-xs text-[#6b7a99]">
                          · Session {ps.session_number}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={[
                        "rounded-full px-2.5 py-1 text-xs font-bold",
                        s.status === "completed"
                          ? "bg-[#4caf72]/10 text-[#4caf72]"
                          : s.status === "in_progress"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-[#f4f6fb] text-[#6b7a99]",
                      ].join(" ")}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6b7a99]">
                      {new Date(s.created_at).toLocaleDateString("ko-KR", {
                        year: "numeric", month: "2-digit", day: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
