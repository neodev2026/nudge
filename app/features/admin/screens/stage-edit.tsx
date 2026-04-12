/**
 * /admin/products/:id/stages/:stageId
 *
 * Stage editor — edit stage info and manage cards.
 */
import type { Route } from "./+types/stage-edit";

import { Link, useLoaderData, useFetcher, Form } from "react-router";
import { useState } from "react";

import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import { adminGetStageWithCards } from "~/features/admin/lib/queries.server";
import { V2_CARD_TYPES, V2_STAGE_TYPES } from "~/features/v2/shared/constants";
import type { V2CardData } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "스테이지 편집 — Nudge Admin" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);
  const stage = await adminGetStageWithCards(client, params.stageId);
  return { stage, product_id: params.id };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const STAGE_TYPE_LABELS: Record<string, string> = {
  welcome: "안내 (welcome)",
  learning: "학습 (learning)",
  quiz_5: "퀴즈 3단계 (quiz_5)",
  quiz_10: "퀴즈 매칭 (quiz_10)",
  quiz_current_session: "퀴즈 — 현재 세션 (quiz_current_session)",
  quiz_current_and_prev_session: "퀴즈 — 현재+이전 세션 (quiz_current_and_prev_session)",
  quiz_daily: "일일 퀴즈 (quiz_daily)",
  quiz_final: "최종 퀴즈 (quiz_final)",
  congratulations: "축하 (congratulations)",
  sentence_practice: "문장 연습 (sentence_practice)",
  dictation: "받아쓰기 (dictation)",
  writing: "작문 연습 (writing)",
};

const CARD_TYPE_LABELS: Record<string, string> = {
  title: "단어/제목 (title)",
  description: "의미/설명 (description)",
  image: "이미지 (image)",
  etymology: "어원 (etymology)",
  example: "예문 (example)",
  option: "선택지 (option)",
};

export default function AdminStageEdit() {
  const { stage, product_id } = useLoaderData<typeof loader>();
  const stage_fetcher = useFetcher();
  const card_delete_fetcher = useFetcher();
  const [adding_card, set_adding_card] = useState(false);

  const cards = [...(stage.nv2_cards ?? [])].sort(
    (a, b) => a.display_order - b.display_order
  );

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="mb-8 flex items-center gap-2 text-sm">
        <Link to="/admin" className="text-[#6b7a99] hover:text-[#1a2744]">어드민</Link>
        <span className="text-[#e8ecf5]">/</span>
        <Link to={`/admin/products/${product_id}`} className="text-[#6b7a99] hover:text-[#1a2744]">상품</Link>
        <span className="text-[#e8ecf5]">/</span>
        <span className="font-semibold text-[#1a2744]">{stage.title}</span>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {/* ── Stage info form ── */}
        <section>
          <h2 className="mb-4 font-display text-lg font-black text-[#1a2744]">
            스테이지 정보
          </h2>
          <stage_fetcher.Form
            method="post"
            action="/admin/api/stages/upsert"
            className="rounded-2xl border border-[#e8ecf5] bg-white p-6 space-y-4"
          >
            <input type="hidden" name="id" value={stage.id} />
            <input type="hidden" name="learning_product_id" value={stage.learning_product_id} />

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[#1a2744]">제목</label>
              <input
                name="title"
                defaultValue={stage.title}
                required
                className="w-full rounded-xl border border-[#e8ecf5] px-4 py-2.5 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[#1a2744]">스테이지 번호</label>
              <input
                name="stage_number"
                type="number"
                defaultValue={stage.stage_number}
                required
                className="w-full rounded-xl border border-[#e8ecf5] px-4 py-2.5 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-[#1a2744]">타입</label>
              <select
                name="stage_type"
                defaultValue={stage.stage_type}
                className="w-full rounded-xl border border-[#e8ecf5] px-4 py-2.5 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
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
                defaultChecked={stage.is_active}
                value="true"
                className="h-4 w-4 rounded"
              />
              <label htmlFor="is_active" className="text-sm font-semibold text-[#1a2744]">
                활성
              </label>
            </div>

            <button
              type="submit"
              disabled={stage_fetcher.state !== "idle"}
              className="rounded-xl bg-[#1a2744] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#243358] disabled:opacity-60"
            >
              {stage_fetcher.state !== "idle" ? "저장 중..." : "저장"}
            </button>

            {stage_fetcher.data && "ok" in stage_fetcher.data && (
              <p className="text-sm font-semibold text-[#4caf72]">저장됐습니다 ✓</p>
            )}
          </stage_fetcher.Form>
        </section>

        {/* ── Cards ── */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-black text-[#1a2744]">
              카드 목록
              <span className="ml-2 text-sm font-normal text-[#6b7a99]">
                {cards.length}개
              </span>
            </h2>
            {stage.stage_type.startsWith("quiz") || stage.stage_type === "congratulations" || stage.stage_type === "dictation" ? null : (
              <button
                onClick={() => set_adding_card(true)}
                className="rounded-xl bg-[#4caf72] px-4 py-2 text-xs font-extrabold text-white hover:bg-[#5ecb87]"
              >
                + 카드 추가
              </button>
            )}
          </div>

          {/* Quiz / congratulations / dictation stage notice */}
          {(stage.stage_type.startsWith("quiz") || stage.stage_type === "congratulations" || stage.stage_type === "dictation") && (
            <div className="rounded-2xl border border-[#4caf72]/30 bg-[#4caf72]/5 px-5 py-4 text-sm text-[#4caf72] font-semibold">
              {stage.stage_type.startsWith("quiz")
                ? "퀴즈 스테이지는 카드를 추가할 필요가 없습니다. 세션 내 앞선 learning 스테이지의 카드를 자동으로 가져와 퀴즈를 구성합니다."
                : stage.stage_type === "dictation"
                ? "받아쓰기 스테이지는 카드가 필요 없습니다. 세션 내 learning 스테이지의 예문 카드를 자동으로 사용합니다."
                : "congratulations 스테이지는 카드가 필요 없습니다. 전체 학습 완료 시 자동으로 표시됩니다."}
            </div>
          )}

          <div className="space-y-3">
            {cards.map((card) => (
              <CardRow
                key={card.id}
                card={card}
                stage_id={stage.id}
              />
            ))}

            {/* New card form */}
            {adding_card && (
              <CardForm
                stage_id={stage.id}
                display_order={cards.length + 1}
                onCancel={() => set_adding_card(false)}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardRow
// ---------------------------------------------------------------------------

function CardRow({ card, stage_id }: { card: any; stage_id: string }) {
  const [is_editing, set_is_editing] = useState(false);
  const delete_fetcher = useFetcher();
  const card_data = card.card_data as V2CardData;

  if (is_editing) {
    return (
      <CardForm
        stage_id={stage_id}
        card={card}
        display_order={card.display_order}
        onCancel={() => set_is_editing(false)}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-[#e8ecf5] bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-[#1a2744] px-2 py-0.5 text-xs font-black text-white">
            {card.display_order}
          </span>
          <span className="rounded-lg bg-[#f4f6fb] px-2 py-0.5 text-xs font-bold text-[#6b7a99]">
            {CARD_TYPE_LABELS[card.card_type] ?? card.card_type}
          </span>
          {!card.is_active && (
            <span className="rounded-full bg-[#e8ecf5] px-2 py-0.5 text-xs font-bold text-[#6b7a99]">
              비활성
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => set_is_editing(true)}
            className="text-xs font-bold text-[#6b7a99] hover:text-[#1a2744]"
          >
            편집
          </button>
          <delete_fetcher.Form
            method="post"
            action={`/admin/api/cards/${card.id}/delete`}
            onSubmit={(e) => {
              if (!confirm("이 카드를 삭제할까요?")) e.preventDefault();
            }}
          >
            <button
              type="submit"
              className="text-xs font-bold text-red-400 hover:text-red-600"
            >
              삭제
            </button>
          </delete_fetcher.Form>
        </div>
      </div>
      <p className="text-sm font-semibold text-[#1a2744]">
        {card_data.presentation?.front}
      </p>
      {/* Image preview for image cards */}
      {card.card_type === "image" && card_data.presentation?.front && (
        <div className="mt-2 overflow-hidden rounded-xl border border-[#e8ecf5]">
          <img
            src={card_data.presentation.front}
            alt="이미지 카드"
            className="max-h-32 w-full object-contain bg-[#f4f6fb]"
          />
        </div>
      )}
      {card.card_type !== "image" && card_data.presentation?.back && (
        <p className="mt-0.5 text-xs text-[#6b7a99]">
          {card_data.presentation.back}
        </p>
      )}
      {card_data.presentation?.hint && (
        <p className="mt-0.5 text-xs italic text-[#6b7a99]">
          {card_data.presentation.hint}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardForm — add / edit
// ---------------------------------------------------------------------------

function CardForm({
  stage_id,
  card,
  display_order,
  onCancel,
}: {
  stage_id: string;
  card?: any;
  display_order: number;
  onCancel: () => void;
}) {
  const fetcher = useFetcher<{ ok?: boolean }>();
  const card_data = card?.card_data as V2CardData | undefined;
  const [card_type, set_card_type] = useState(card?.card_type ?? "title");
  const [image_url, set_image_url] = useState(
    card_data?.presentation?.front ?? ""
  );

  // Close on success
  if (fetcher.data?.ok) {
    onCancel();
  }

  const is_image = card_type === "image";

  return (
    <fetcher.Form
      method="post"
      action="/admin/api/cards/upsert"
      className="rounded-2xl border-2 border-[#4caf72]/30 bg-white p-5 space-y-3"
    >
      {card && <input type="hidden" name="id" value={card.id} />}
      <input type="hidden" name="stage_id" value={stage_id} />

      <div className="grid grid-cols-2 gap-3">
        {/* Card type */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#1a2744]">카드 타입</label>
          <select
            name="card_type"
            defaultValue={card?.card_type ?? "title"}
            onChange={(e) => set_card_type(e.target.value)}
            className="w-full rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
          >
            {V2_CARD_TYPES.map((t) => (
              <option key={t} value={t}>{CARD_TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
        </div>

        {/* Display order */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#1a2744]">순서</label>
          <input
            name="display_order"
            type="number"
            defaultValue={display_order}
            required
            className="w-full rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
          />
        </div>
      </div>

      {/* Front */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-[#1a2744]">
          {is_image ? "이미지 URL (front)" : "앞면 (front)"}
        </label>
        <input
          name="front"
          defaultValue={card_data?.presentation?.front ?? ""}
          required
          placeholder={is_image ? "https://example.com/image.jpg" : "단어 또는 표시 텍스트"}
          onChange={is_image ? (e) => set_image_url(e.target.value) : undefined}
          className="w-full rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
        />
        {/* Image preview */}
        {is_image && image_url && (
          <div className="mt-2 overflow-hidden rounded-xl border border-[#e8ecf5]">
            <img
              src={image_url}
              alt="미리보기"
              className="max-h-48 w-full object-contain bg-[#f4f6fb]"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
              onLoad={(e) => {
                (e.target as HTMLImageElement).style.display = "block";
              }}
            />
          </div>
        )}
      </div>

      {/* Back */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-[#1a2744]">뒷면 (back)</label>
        <input
          name="back"
          defaultValue={card_data?.presentation?.back ?? ""}
          placeholder="의미 또는 번역"
          className="w-full rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
        />
      </div>

      {/* Hint */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-[#1a2744]">힌트 (hint) — 선택</label>
        <input
          name="hint"
          defaultValue={card_data?.presentation?.hint ?? ""}
          placeholder="/발음/ · 품사"
          className="w-full rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
        />
      </div>

      {/* Explanation */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-[#1a2744]">설명 (explanation)</label>
        <textarea
          name="explanation"
          defaultValue={card_data?.details?.explanation ?? ""}
          rows={2}
          className="w-full rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
        />
      </div>

      {/* Example */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#1a2744]">예문 — 선택</label>
          <input
            name="example_sentence"
            defaultValue={card_data?.details?.example_context?.sentence ?? ""}
            placeholder="예문 (target language)"
            className="w-full rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#1a2744]">예문 번역 — 선택</label>
          <input
            name="example_translation"
            defaultValue={card_data?.details?.example_context?.translation ?? ""}
            placeholder="번역"
            className="w-full rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
          />
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#1a2744]">target_locale</label>
          <input
            name="target_locale"
            defaultValue={card_data?.meta?.target_locale ?? "de"}
            className="w-full rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#1a2744]">learner_locale</label>
          <input
            name="learner_locale"
            defaultValue={card_data?.meta?.learner_locale ?? "ko"}
            className="w-full rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm text-[#1a2744] outline-none focus:border-[#1a2744]"
          />
        </div>
      </div>
      {/* logic_key is set automatically to stage_id in the API */}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="is_active"
          id={`card_active_${card?.id ?? "new"}`}
          defaultChecked={card?.is_active ?? true}
          value="true"
          className="h-4 w-4 rounded"
        />
        <label htmlFor={`card_active_${card?.id ?? "new"}`} className="text-sm font-semibold text-[#1a2744]">
          활성
        </label>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={fetcher.state !== "idle"}
          className="rounded-xl bg-[#4caf72] px-5 py-2 text-sm font-extrabold text-white hover:bg-[#5ecb87] disabled:opacity-60"
        >
          {fetcher.state !== "idle" ? "저장 중..." : "저장"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-[#e8ecf5] px-5 py-2 text-sm font-bold text-[#6b7a99] hover:bg-[#f4f6fb]"
        >
          취소
        </button>
      </div>
    </fetcher.Form>
  );
}
