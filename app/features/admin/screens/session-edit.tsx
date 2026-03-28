/**
 * /admin/products/:id/sessions/new
 * /admin/products/:id/sessions/:sessionId
 *
 * Session editor — create or edit a product session.
 * Allows assigning stages to a session and ordering them.
 *
 * UI:
 *   Left column  — unassigned stages (click to add)
 *   Right column — stages in this session (click to remove, arrows to reorder)
 */
import type { Route } from "./+types/session-edit";

import { Link, useLoaderData } from "react-router";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "세션 편집 — Nudge Admin" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const { default: makeServerClient } = await import("~/core/lib/supa-client.server");
  const { requireAdmin } = await import("~/features/admin/lib/guards.server");
  const {
    adminGetProductById,
    adminGetStagesByProduct,
    adminGetSessionsByProduct,
  } = await import("~/features/admin/lib/queries.server");

  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const is_new = !params.sessionId || params.sessionId === "new";

  const [product, all_stages, all_sessions] = await Promise.all([
    adminGetProductById(client, params.id),
    adminGetStagesByProduct(client, params.id),
    adminGetSessionsByProduct(client, params.id),
  ]);

  const current_session = is_new
    ? null
    : all_sessions.find((s) => s.id === params.sessionId) ?? null;

  const assigned_stage_ids: string[] = is_new
    ? []
    : (current_session?.nv2_product_session_stages ?? [])
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((s: any) => s.stage_id);

  const other_assigned_ids = new Set(
    all_sessions
      .filter((s) => s.id !== params.sessionId)
      .flatMap((s) =>
        (s.nv2_product_session_stages ?? []).map((pss: any) => pss.stage_id)
      )
  );

  const max_session_number = all_sessions.reduce(
    (max, s) => Math.max(max, s.session_number),
    0
  );

  return {
    product,
    all_stages,
    assigned_stage_ids,
    other_assigned_ids: Array.from(other_assigned_ids),
    current_session,
    is_new,
    next_session_number: max_session_number + 1,
    product_id: params.id,
  };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request, params }: Route.ActionArgs) {
  const { default: makeServerClient } = await import("~/core/lib/supa-client.server");
  const { requireAdmin } = await import("~/features/admin/lib/guards.server");
  const { adminUpsertProductSession, adminSetSessionStages } = await import(
    "~/features/admin/lib/queries.server"
  );
  const { redirect } = await import("react-router");
  const { data: routeData } = await import("react-router");

  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const form_data = await request.formData();
  const session_id = form_data.get("session_id") as string | null;
  const title = (form_data.get("title") as string) || null;
  const session_number = Number(form_data.get("session_number"));
  const is_active = form_data.get("is_active") === "true";
  const stage_ids_raw = (form_data.get("stage_ids") as string) || "";
  const stage_ids = stage_ids_raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!session_number) {
    return routeData({ error: "세션 번호는 필수입니다." }, { status: 400 });
  }

  const result = await adminUpsertProductSession(client, {
    ...(session_id ? { id: session_id } : {}),
    product_id: params.id,
    session_number,
    title,
    is_active,
  });

  await adminSetSessionStages(client, result.id, stage_ids);

  return redirect(`/admin/products/${params.id}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STAGE_TYPE_LABELS: Record<string, string> = {
  welcome: "안내",
  learning: "학습",
  quiz_5: "퀴즈(5)",
  quiz_10: "퀴즈(10)",
  quiz_daily: "일일퀴즈",
  quiz_final: "최종퀴즈",
  congratulations: "축하",
};

const STAGE_TYPE_COLORS: Record<string, string> = {
  welcome: "bg-blue-50 text-blue-600",
  learning: "bg-[#4caf72]/10 text-[#4caf72]",
  quiz_5: "bg-orange-50 text-orange-500",
  quiz_10: "bg-orange-50 text-orange-600",
  quiz_daily: "bg-purple-50 text-purple-500",
  quiz_final: "bg-red-50 text-red-500",
  congratulations: "bg-yellow-50 text-yellow-600",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminSessionEdit({
  actionData,
}: Route.ComponentProps) {
  const {
    product,
    all_stages,
    assigned_stage_ids,
    other_assigned_ids,
    current_session,
    is_new,
    next_session_number,
    product_id,
  } = useLoaderData<typeof loader>();

  // Local state for stage assignment
  const [session_stages, set_session_stages] = useState<string[]>(
    assigned_stage_ids
  );

  const other_set = new Set(other_assigned_ids);

  // Stages not yet in this session
  const unassigned = all_stages.filter(
    (s) => !session_stages.includes(s.id) && !other_set.has(s.id)
  );

  // Already assigned to other sessions
  const in_other = all_stages.filter(
    (s) => other_set.has(s.id) && !session_stages.includes(s.id)
  );

  function addStage(stage_id: string) {
    set_session_stages((prev) => [...prev, stage_id]);
  }

  function removeStage(stage_id: string) {
    set_session_stages((prev) => prev.filter((id) => id !== stage_id));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    set_session_stages((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    set_session_stages((prev) => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  // Map stage_id → stage object for display
  const stage_map = Object.fromEntries(all_stages.map((s) => [s.id, s]));

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-2 text-sm">
        <Link to="/admin" className="text-[#6b7a99] hover:text-[#1a2744]">어드민</Link>
        <span className="text-[#e8ecf5]">/</span>
        <Link
          to={`/admin/products/${product_id}`}
          className="text-[#6b7a99] hover:text-[#1a2744]"
        >
          {product.name}
        </Link>
        <span className="text-[#e8ecf5]">/</span>
        <span className="font-semibold text-[#1a2744]">
          {is_new ? "세션 추가" : `세션 ${current_session?.session_number} 편집`}
        </span>
      </div>

      <form method="post">
        {/* Hidden field — comma-separated ordered stage IDs */}
        <input
          type="hidden"
          name="stage_ids"
          value={session_stages.join(",")}
        />
        {current_session && (
          <input type="hidden" name="session_id" value={current_session.id} />
        )}

        {/* Session meta */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a2744]">
              세션 번호
            </label>
            <input
              name="session_number"
              type="number"
              defaultValue={
                current_session?.session_number ?? next_session_number
              }
              required
              className="w-full rounded-xl border border-[#e8ecf5] bg-white px-4 py-2.5 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a2744]">
              세션 제목 (선택)
            </label>
            <input
              name="title"
              defaultValue={current_session?.title ?? ""}
              placeholder="예: Day 1 — 기초 인사말"
              className="w-full rounded-xl border border-[#e8ecf5] bg-white px-4 py-2.5 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
            />
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={current_session?.is_active ?? false}
                value="true"
                className="h-4 w-4 rounded"
              />
              <span className="text-sm font-semibold text-[#1a2744]">활성화</span>
            </label>
          </div>
        </div>

        {/* Stage assignment */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left — unassigned stages */}
          <div>
            <h3 className="mb-3 font-display text-base font-black text-[#1a2744]">
              미배정 스테이지
              <span className="ml-2 text-sm font-normal text-[#6b7a99]">
                클릭하여 추가
              </span>
            </h3>
            <div className="min-h-[200px] space-y-2 rounded-2xl border border-dashed border-[#e8ecf5] bg-[#f4f6fb] p-3">
              {unassigned.length === 0 && in_other.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#6b7a99]">
                  배정 가능한 스테이지가 없습니다.
                </p>
              ) : (
                <>
                  {unassigned.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => addStage(s.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[#e8ecf5] bg-white px-4 py-3 text-left transition-all hover:border-[#4caf72] hover:shadow-sm"
                    >
                      <span className="w-6 text-xs font-mono text-[#6b7a99]">
                        {s.stage_number}
                      </span>
                      <span className="flex-1 text-sm font-semibold text-[#1a2744]">
                        {s.title}
                      </span>
                      <span
                        className={[
                          "rounded-lg px-2 py-0.5 text-xs font-bold",
                          STAGE_TYPE_COLORS[s.stage_type] ?? "bg-[#f4f6fb] text-[#6b7a99]",
                        ].join(" ")}
                      >
                        {STAGE_TYPE_LABELS[s.stage_type] ?? s.stage_type}
                      </span>
                      <span className="text-[#4caf72] font-bold">+</span>
                    </button>
                  ))}

                  {/* Stages assigned to other sessions */}
                  {in_other.length > 0 && (
                    <>
                      <p className="px-2 pt-2 text-xs font-bold text-[#6b7a99]">
                        다른 세션에 배정됨
                      </p>
                      {in_other.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 rounded-xl border border-[#e8ecf5] bg-white/50 px-4 py-3 opacity-50"
                        >
                          <span className="w-6 text-xs font-mono text-[#6b7a99]">
                            {s.stage_number}
                          </span>
                          <span className="flex-1 text-sm font-semibold text-[#6b7a99]">
                            {s.title}
                          </span>
                          <span
                            className={[
                              "rounded-lg px-2 py-0.5 text-xs font-bold",
                              STAGE_TYPE_COLORS[s.stage_type] ?? "bg-[#f4f6fb] text-[#6b7a99]",
                            ].join(" ")}
                          >
                            {STAGE_TYPE_LABELS[s.stage_type] ?? s.stage_type}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right — session stages */}
          <div>
            <h3 className="mb-3 font-display text-base font-black text-[#1a2744]">
              이 세션의 스테이지
              <span className="ml-2 text-sm font-normal text-[#6b7a99]">
                {session_stages.length}개
              </span>
            </h3>
            <div className="min-h-[200px] space-y-2 rounded-2xl border border-[#1a2744]/10 bg-white p-3">
              {session_stages.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#6b7a99]">
                  왼쪽에서 스테이지를 선택하세요.
                </p>
              ) : (
                session_stages.map((stage_id, i) => {
                  const s = stage_map[stage_id];
                  if (!s) return null;
                  return (
                    <div
                      key={stage_id}
                      className="flex items-center gap-2 rounded-xl border border-[#e8ecf5] bg-[#f4f6fb] px-3 py-2.5"
                    >
                      {/* Order number */}
                      <span className="w-5 text-center text-xs font-black text-[#6b7a99]">
                        {i + 1}
                      </span>

                      {/* Up/Down */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveUp(i)}
                          disabled={i === 0}
                          className="text-[#6b7a99] hover:text-[#1a2744] disabled:opacity-20 text-xs leading-none"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(i)}
                          disabled={i === session_stages.length - 1}
                          className="text-[#6b7a99] hover:text-[#1a2744] disabled:opacity-20 text-xs leading-none"
                        >
                          ▼
                        </button>
                      </div>

                      {/* Stage info */}
                      <span className="flex-1 text-sm font-semibold text-[#1a2744]">
                        {s.title}
                      </span>
                      <span
                        className={[
                          "rounded-lg px-2 py-0.5 text-xs font-bold",
                          STAGE_TYPE_COLORS[s.stage_type] ?? "bg-[#f4f6fb] text-[#6b7a99]",
                        ].join(" ")}
                      >
                        {STAGE_TYPE_LABELS[s.stage_type] ?? s.stage_type}
                      </span>

                      {/* Remove */}
                      <button
                        type="button"
                        onClick={() => removeStage(stage_id)}
                        className="ml-1 rounded-lg px-2 py-1 text-xs font-bold text-red-400 hover:bg-red-50 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {actionData && "error" in actionData && (
          <p className="mt-4 text-sm font-semibold text-red-500">
            {actionData.error}
          </p>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            className="rounded-xl bg-[#1a2744] px-7 py-3 text-sm font-extrabold text-white hover:bg-[#243358]"
          >
            {is_new ? "세션 생성" : "저장"}
          </button>
          <Link
            to={`/admin/products/${product_id}`}
            className="rounded-xl border border-[#e8ecf5] px-7 py-3 text-sm font-bold text-[#6b7a99] hover:bg-[#f4f6fb]"
          >
            취소
          </Link>
        </div>
      </form>
    </div>
  );
}
