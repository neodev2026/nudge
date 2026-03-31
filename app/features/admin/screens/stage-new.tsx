/**
 * /admin/products/:id/stages/new
 *
 * Create a new stage for a product.
 */
import type { Route } from "./+types/stage-new";

import { redirect, Form, useLoaderData } from "react-router";
import { data as routeData } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import {
  adminGetProductById,
  adminGetMaxStageNumber,
  adminUpsertStage,
} from "~/features/admin/lib/queries.server";
import { V2_STAGE_TYPES } from "~/features/v2/shared/constants";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "스테이지 추가 — Nudge Admin" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);
  const [product, max_number] = await Promise.all([
    adminGetProductById(client, params.id),
    adminGetMaxStageNumber(client, params.id),
  ]);
  return { product, next_stage_number: max_number + 1 };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request, params }: Route.ActionArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const form_data = await request.formData();
  const title = form_data.get("title") as string;
  const stage_number = Number(form_data.get("stage_number"));
  const stage_type = form_data.get("stage_type") as string;
  const is_active = form_data.get("is_active") === "true";

  if (!title || !stage_type) {
    return routeData({ error: "제목과 타입은 필수입니다." }, { status: 400 });
  }

  const result = await adminUpsertStage(client, {
    learning_product_id: params.id,
    stage_number,
    stage_type,
    title,
    is_active,
  });

  return redirect(`/admin/products/${params.id}/stages/${result.id}`);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const STAGE_TYPE_LABELS: Record<string, string> = {
  welcome: "안내 (welcome)",
  learning: "학습 (learning)",
  quiz_5: "퀴즈 — 5개 (quiz_5)",
  quiz_10: "퀴즈 — 10개 (quiz_10)",
  quiz_daily: "일일 퀴즈 (quiz_daily)",
  quiz_final: "최종 퀴즈 (quiz_final)",
  congratulations: "축하 (congratulations)",
};

export default function AdminStageNew({
  actionData,
}: Route.ComponentProps) {
  const { product, next_stage_number } = useLoaderData<typeof loader>();

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-2 text-sm">
        <a href="/admin" className="text-[#6b7a99] hover:text-[#1a2744]">어드민</a>
        <span className="text-[#e8ecf5]">/</span>
        <a href={`/admin/products/${product.id}`} className="text-[#6b7a99] hover:text-[#1a2744]">
          {product.name}
        </a>
        <span className="text-[#e8ecf5]">/</span>
        <span className="font-semibold text-[#1a2744]">스테이지 추가</span>
      </div>

      <div className="max-w-lg">
        <h1 className="mb-6 font-display text-2xl font-black text-[#1a2744]">
          새 스테이지
        </h1>

        <Form
          method="post"
          className="rounded-2xl border border-[#e8ecf5] bg-white p-6 space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a2744]">제목</label>
            <input
              name="title"
              required
              placeholder="예: Hallo"
              className="w-full rounded-xl border border-[#e8ecf5] bg-white px-4 py-2.5 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a2744]">스테이지 번호</label>
            <input
              name="stage_number"
              type="number"
              defaultValue={next_stage_number}
              required
              className="w-full rounded-xl border border-[#e8ecf5] bg-white px-4 py-2.5 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
            />
            <p className="text-xs text-[#6b7a99]">
              welcome은 0, learning은 1부터 순차적으로 입력하세요.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a2744]">타입</label>
            <select
              name="stage_type"
              defaultValue="learning"
              className="w-full rounded-xl border border-[#e8ecf5] bg-white px-4 py-2.5 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
            >
              {V2_STAGE_TYPES.map((t) => (
                <option key={t} value={t}>{STAGE_TYPE_LABELS[t] ?? t}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_active"
              id="is_active"
              defaultChecked={false}
              value="true"
              className="h-4 w-4 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-semibold text-[#1a2744]">
              즉시 활성화
            </label>
          </div>

          {actionData && "error" in actionData && (
            <p className="text-sm font-semibold text-red-500">{actionData.error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              className="rounded-xl bg-[#1a2744] px-6 py-2.5 text-sm font-extrabold text-white hover:bg-[#243358]"
            >
              스테이지 생성 →
            </button>
            <a
              href={`/admin/products/${product.id}`}
              className="rounded-xl border border-[#e8ecf5] px-6 py-2.5 text-sm font-bold text-[#6b7a99] hover:bg-[#f4f6fb]"
            >
              취소
            </a>
          </div>
        </Form>
      </div>
    </div>
  );
}
