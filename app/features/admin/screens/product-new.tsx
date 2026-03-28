/**
 * /admin/products/new
 *
 * Create a new learning product.
 * On submit, redirects to the product detail page for stage/session setup.
 *
 * meta field is built from category-specific sub-fields:
 *   language → { language, level }
 *   exam     → { exam_name, year }
 *   medical  → { domain, exam }
 *   others   → {}
 */
import type { Route } from "./+types/product-new";

import { Form, useLoaderData } from "react-router";
import { useState } from "react";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "상품 추가 — Nudge Admin" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const { default: makeServerClient } = await import("~/core/lib/supa-client.server");
  const { requireAdmin } = await import("~/features/admin/lib/guards.server");
  const { adminGetAllProducts } = await import("~/features/admin/lib/queries.server");

  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  // Get max display_order for default value
  const products = await adminGetAllProducts(client);
  const max_order = products.reduce((m, p) => Math.max(m, p.display_order), 0);

  return { next_display_order: max_order + 1 };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
  const { default: makeServerClient } = await import("~/core/lib/supa-client.server");
  const { requireAdmin } = await import("~/features/admin/lib/guards.server");
  const { adminUpsertProduct } = await import("~/features/admin/lib/queries.server");
  const { redirect } = await import("react-router");
  const { data: routeData } = await import("react-router");

  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const form_data = await request.formData();
  const name = form_data.get("name") as string;
  const slug = form_data.get("slug") as string;
  const category = form_data.get("category") as string;
  const icon = (form_data.get("icon") as string) || null;
  const description = (form_data.get("description") as string) || null;
  const display_order = Number(form_data.get("display_order")) || 0;
  const is_active = form_data.get("is_active") === "true";

  if (!name || !slug || !category) {
    return routeData(
      { error: "상품명, 슬러그, 카테고리는 필수입니다." },
      { status: 400 }
    );
  }

  // Slug validation — URL-safe characters only
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return routeData(
      { error: "슬러그는 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다." },
      { status: 400 }
    );
  }

  // Build meta from category-specific fields
  let meta: Record<string, unknown> = {};
  if (category === "language") {
    const language = (form_data.get("meta_language") as string) || "";
    const level = (form_data.get("meta_level") as string) || "";
    if (language) meta = { language, level };
  } else if (category === "exam") {
    const exam_name = (form_data.get("meta_exam_name") as string) || "";
    const year = (form_data.get("meta_year") as string) || "";
    if (exam_name) meta = { exam_name, ...(year ? { year } : {}) };
  } else if (category === "medical") {
    const domain = (form_data.get("meta_domain") as string) || "";
    const exam = (form_data.get("meta_exam") as string) || "";
    meta = {
      ...(domain ? { domain } : {}),
      ...(exam ? { exam } : {}),
    };
  }

  const result = await adminUpsertProduct(client, {
    category,
    name,
    slug,
    icon,
    description,
    meta,
    display_order,
    is_active,
  });

  return redirect(`/admin/products/${result.id}`);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CATEGORY_OPTIONS = [
  { value: "language", label: "언어 학습" },
  { value: "medical", label: "의학 용어" },
  { value: "exam", label: "자격증 / 시험" },
  { value: "business", label: "비즈니스" },
  { value: "general", label: "일반" },
];

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const LANGUAGE_OPTIONS = [
  { value: "de", label: "독일어 (de)" },
  { value: "en", label: "영어 (en)" },
  { value: "ja", label: "일본어 (ja)" },
  { value: "zh", label: "중국어 (zh)" },
  { value: "fr", label: "프랑스어 (fr)" },
  { value: "es", label: "스페인어 (es)" },
];

const INPUT_CLASS =
  "w-full rounded-xl border border-[#e8ecf5] bg-white px-4 py-2.5 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]";

export default function AdminProductNew({
  actionData,
}: {
  actionData?: { error: string } | null;
}) {
  const { next_display_order } = useLoaderData<typeof loader>();
  const [category, set_category] = useState("language");

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-2 text-sm">
        <a href="/admin" className="text-[#6b7a99] hover:text-[#1a2744]">
          어드민
        </a>
        <span className="text-[#e8ecf5]">/</span>
        <span className="font-semibold text-[#1a2744]">상품 추가</span>
      </div>

      <div className="max-w-lg">
        <h1 className="mb-6 font-display text-2xl font-black text-[#1a2744]">
          새 학습 상품
        </h1>

        <Form
          method="post"
          className="space-y-5 rounded-2xl border border-[#e8ecf5] bg-white p-6"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a2744]">
              상품명 <span className="text-red-400">*</span>
            </label>
            <input
              name="name"
              required
              placeholder="예: Deutsch A1"
              className={INPUT_CLASS}
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a2744]">
              슬러그 <span className="text-red-400">*</span>
            </label>
            <input
              name="slug"
              required
              placeholder="예: deutsch-a1"
              className={INPUT_CLASS}
            />
            <p className="text-xs text-[#6b7a99]">
              소문자, 숫자, 하이픈(-)만 사용 가능. URL에 표시됩니다.
            </p>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a2744]">
              카테고리 <span className="text-red-400">*</span>
            </label>
            <select
              name="category"
              value={category}
              onChange={(e) => set_category(e.target.value)}
              className={INPUT_CLASS}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category-specific meta fields */}
          {category === "language" && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#f4f6fb] p-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a2744]">
                  언어
                </label>
                <select name="meta_language" className={INPUT_CLASS}>
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a2744]">
                  CEFR 레벨
                </label>
                <select name="meta_level" className={INPUT_CLASS}>
                  {CEFR_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {category === "exam" && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#f4f6fb] p-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a2744]">
                  시험명
                </label>
                <input
                  name="meta_exam_name"
                  placeholder="예: 정보처리기사"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a2744]">
                  연도 (선택)
                </label>
                <input
                  name="meta_year"
                  placeholder="예: 2025"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          )}

          {category === "medical" && (
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#f4f6fb] p-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a2744]">
                  도메인 (선택)
                </label>
                <input
                  name="meta_domain"
                  placeholder="예: terminology"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a2744]">
                  시험 (선택)
                </label>
                <input
                  name="meta_exam"
                  placeholder="예: KMLE"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          )}

          {/* Icon */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a2744]">
              아이콘 (이모지)
            </label>
            <input
              name="icon"
              placeholder="예: 🇩🇪"
              className={INPUT_CLASS}
            />
            <p className="text-xs text-[#6b7a99]">
              국기 이모지 또는 관련 이모지를 입력하세요.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a2744]">
              설명 (선택)
            </label>
            <textarea
              name="description"
              rows={2}
              placeholder="예: 독일어 입문. 생활 기초 단어부터."
              className="w-full rounded-xl border border-[#e8ecf5] bg-white px-4 py-2.5 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
            />
          </div>

          {/* Display order */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-[#1a2744]">
              표시 순서
            </label>
            <input
              name="display_order"
              type="number"
              defaultValue={next_display_order}
              className={INPUT_CLASS}
            />
            <p className="text-xs text-[#6b7a99]">
              숫자가 작을수록 앞에 표시됩니다.
            </p>
          </div>

          {/* Active */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="is_active"
              id="is_active"
              value="true"
              className="h-4 w-4 rounded"
            />
            <label
              htmlFor="is_active"
              className="text-sm font-semibold text-[#1a2744]"
            >
              즉시 활성화
            </label>
          </div>

          {/* Error */}
          {actionData && "error" in actionData && (
            <p className="text-sm font-semibold text-red-500">
              {actionData.error}
            </p>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              className="rounded-xl bg-[#1a2744] px-6 py-2.5 text-sm font-extrabold text-white hover:bg-[#243358]"
            >
              상품 생성 →
            </button>
            <a
              href="/admin"
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
