/**
 * /quiz/:stageId?session=:sessionId
 *
 * Matching quiz page.
 *
 * - Collects title + description cards from preceding learning stages
 * - Displays cards in two columns (shuffled)
 * - User taps title → then matching description (or vice versa)
 * - Correct pair disappears, two new cards slide in from the pool
 * - Timer duration is configured per stage_type in QUIZ_TIMER_SECONDS
 * - On timer end → POST /api/v2/quiz/:stageId/result → redirect to session
 */
import type { Route } from "./+types/quiz-page";

import { useLoaderData, useFetcher } from "react-router";
import { useEffect, useRef, useState, useCallback } from "react";

import makeServerClient from "~/core/lib/supa-client.server";
import { getQuizStageContext, getQuizCardPool } from "../lib/queries.server";
import { getSessionIdentity } from "~/features/v2/session/lib/queries.server";
import { QUIZ_TIMER_SECONDS } from "~/features/v2/shared/constants";
import type { QuizCard } from "../lib/queries.server";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "퀴즈 — Nudge" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);

  const session_id = new URL(request.url).searchParams.get("session");
  if (!session_id) throw new Response("session param required", { status: 400 });

  // Resolve identity from session row (public access)
  const identity = await getSessionIdentity(client, session_id).catch(() => null);
  if (!identity) throw new Response("Session not found", { status: 404 });

  // Load quiz stage context
  const ctx = await getQuizStageContext(client, params.stageId, session_id);
  if (!ctx) throw new Response("Quiz stage not found", { status: 404 });

  const { stage } = ctx;

  // Collect card pool from preceding learning stages
  const card_pool = await getQuizCardPool(
    client,
    identity.product_session_id,
    params.stageId
  );

  // Timer duration from constants (configurable per stage_type)
  const timer_seconds = QUIZ_TIMER_SECONDS[stage.stage_type] ?? 20;

  // Collect unique stage IDs covered
  const covered_stage_ids = [...new Set(card_pool.map((c) => c.stage_id))];

  return {
    stage_id: params.stageId,
    stage_type: stage.stage_type,
    stage_title: stage.title,
    session_id,
    sns_type: identity.sns_type,
    sns_id: identity.sns_id,
    card_pool,
    timer_seconds,
    covered_stage_ids,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const VISIBLE_COUNT = 6; // Number of cards displayed at once (3 title + 3 desc)

export default function QuizPage() {
  const {
    stage_id,
    stage_type,
    stage_title,
    session_id,
    sns_type,
    sns_id,
    card_pool,
    timer_seconds,
    covered_stage_ids,
  } = useLoaderData<typeof loader>();

  const result_fetcher = useFetcher();

  // ── State ─────────────────────────────────────────────────────────────────

  // Total unique pairs in the pool (title card count = pair count)
  const total_pairs = card_pool.filter((c) => c.card_type === "title").length;

  const [time_left, set_time_left] = useState(timer_seconds);
  const [matched_pairs, set_matched_pairs] = useState(0);
  const [selected, set_selected] = useState<QuizCard | null>(null);
  const [matched_ids, set_matched_ids] = useState<Set<string>>(new Set());
  const [shake_id, set_shake_id] = useState<string | null>(null);
  const [is_done, set_is_done] = useState(false);
  const [duration_seconds, set_duration_seconds] = useState(0);

  // Pool pointer — index into card_pool for next cards to display
  const pool_ptr = useRef(0);

  // Build initial visible cards (first N from pool, split by type)
  const [visible_cards, set_visible_cards] = useState<QuizCard[]>(() =>
    buildInitialVisible(card_pool)
  );

  // ── Timer ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (is_done) return;
    if (time_left <= 0) {
      handleTimeUp();
      return;
    }
    const t = setTimeout(() => {
      set_time_left((v) => v - 1);
      set_duration_seconds((v) => v + 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [time_left, is_done]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleTimeUp() {
    set_is_done(true);
    // Submit result
    result_fetcher.submit(
      {
        sns_type,
        sns_id,
        stage_type,
        matched_pairs_count: matched_pairs,
        covered_stage_ids: covered_stage_ids.join(","),
        duration_seconds: timer_seconds,
      },
      {
        method: "POST",
        action: `/api/v2/quiz/${stage_id}/result`,
        encType: "application/json",
      }
    );
  }

  function handleCardClick(card: QuizCard) {
    if (is_done) return;
    if (matched_ids.has(card.card_id)) return;

    if (!selected) {
      set_selected(card);
      return;
    }

    // Same card clicked again — deselect
    if (selected.card_id === card.card_id) {
      set_selected(null);
      return;
    }

    // Check match: same logic_key, different card_type
    const is_match =
      selected.logic_key === card.logic_key &&
      selected.card_type !== card.card_type;

    if (is_match) {
      // Correct pair
      const new_matched = new Set(matched_ids);
      new_matched.add(selected.card_id);
      new_matched.add(card.card_id);
      set_matched_ids(new_matched);

      const new_count = matched_pairs + 1;
      set_matched_pairs(new_count);
      set_selected(null);

      // All pairs matched — finish immediately
      if (new_count >= total_pairs) {
        const elapsed = timer_seconds - time_left + 1;
        set_is_done(true);
        result_fetcher.submit(
          {
            sns_type,
            sns_id,
            stage_type,
            matched_pairs_count: new_count,
            covered_stage_ids: covered_stage_ids.join(","),
            duration_seconds: elapsed,
          },
          {
            method: "POST",
            action: `/api/v2/quiz/${stage_id}/result`,
            encType: "application/json",
          }
        );
        return;
      }

      // Replace matched pair with new cards from pool
      set_visible_cards((prev) => replaceMatched(prev, selected, card, card_pool, pool_ptr));
    } else {
      // Wrong pair — shake
      set_shake_id(card.card_id);
      setTimeout(() => set_shake_id(null), 500);
      set_selected(null);
    }
  }

  // Redirect to session page after result is submitted
  useEffect(() => {
    if (result_fetcher.data && "ok" in (result_fetcher.data as any)) {
      window.location.href = `/sessions/${session_id}`;
    }
  }, [result_fetcher.data]);

  // ── Render ────────────────────────────────────────────────────────────────

  const timer_pct = (time_left / timer_seconds) * 100;
  const timer_color =
    timer_pct > 50 ? "#4caf72" : timer_pct > 25 ? "#f59e0b" : "#ef4444";

  const title_cards = visible_cards.filter((c) => c.card_type === "title");
  const desc_cards = visible_cards.filter((c) => c.card_type === "description");

  if (card_pool.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fdf8f0]">
        <div className="text-center">
          <p className="text-lg font-bold text-[#1a2744]">퀴즈 카드가 없습니다</p>
          <p className="mt-2 text-sm text-[#6b7a99]">
            이 세션에 학습 카드가 없어 퀴즈를 진행할 수 없습니다.
          </p>
          <a
            href={`/sessions/${session_id}`}
            className="mt-4 inline-block rounded-xl bg-[#1a2744] px-6 py-2.5 text-sm font-extrabold text-white"
          >
            세션으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fdf8f0]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8ecf5] px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#4caf72]">
                퀴즈
              </p>
              <h1 className="font-display text-lg font-black text-[#1a2744]">
                {stage_title}
              </h1>
            </div>
            {/* Timer */}
            <div className="flex flex-col items-center">
              <span
                className="font-display text-3xl font-black tabular-nums"
                style={{ color: timer_color }}
              >
                {time_left}
              </span>
              <span className="text-xs text-[#6b7a99]">초</span>
            </div>
          </div>

          {/* Timer bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8ecf5]">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${timer_pct}%`,
                backgroundColor: timer_color,
              }}
            />
          </div>

          {/* Score */}
          <div className="mt-2 text-right text-sm font-bold text-[#6b7a99]">
            맞춘 쌍: <span className="text-[#1a2744]">{matched_pairs}</span>
          </div>
        </div>
      </div>

      {/* Card grid */}
      <div className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl">
          {is_done ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 text-5xl">🎉</div>
              <h2 className="mb-2 font-display text-2xl font-black text-[#1a2744]">
                퀴즈 완료!
              </h2>
              {matched_pairs >= total_pairs ? (
                <p className="text-[#4caf72] font-bold">모든 쌍을 완성했어요! 🏆</p>
              ) : (
                <p className="text-[#6b7a99]">
                  총 <span className="font-black text-[#4caf72]">{matched_pairs}</span>쌍을 맞췄습니다
                </p>
              )}
              <p className="mt-2 text-sm text-[#6b7a99]">
                세션으로 돌아가는 중...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Title cards column */}
              <div className="space-y-3">
                <p className="text-center text-xs font-bold uppercase tracking-wider text-[#6b7a99]">
                  단어
                </p>
                {title_cards.map((card) => (
                  <QuizCardButton
                    key={card.card_id}
                    card={card}
                    is_selected={selected?.card_id === card.card_id}
                    is_matched={matched_ids.has(card.card_id)}
                    is_shaking={shake_id === card.card_id}
                    onClick={() => handleCardClick(card)}
                  />
                ))}
              </div>

              {/* Description cards column */}
              <div className="space-y-3">
                <p className="text-center text-xs font-bold uppercase tracking-wider text-[#6b7a99]">
                  의미
                </p>
                {desc_cards.map((card) => (
                  <QuizCardButton
                    key={card.card_id}
                    card={card}
                    is_selected={selected?.card_id === card.card_id}
                    is_matched={matched_ids.has(card.card_id)}
                    is_shaking={shake_id === card.card_id}
                    onClick={() => handleCardClick(card)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuizCardButton
// ---------------------------------------------------------------------------

function QuizCardButton({
  card,
  is_selected,
  is_matched,
  is_shaking,
  onClick,
}: {
  card: QuizCard;
  is_selected: boolean;
  is_matched: boolean;
  is_shaking: boolean;
  onClick: () => void;
}) {
  const text = card.card_type === "title" ? card.front : card.back;

  if (is_matched) {
    return (
      <div className="h-16 rounded-2xl border-2 border-[#4caf72]/20 bg-[#4caf72]/5" />
    );
  }

  return (
    <button
      onClick={onClick}
      className={[
        "w-full rounded-2xl border-2 px-3 py-4 text-sm font-bold transition-all active:scale-[0.97]",
        is_selected
          ? "border-[#1a2744] bg-[#1a2744] text-white shadow-[0_4px_16px_rgba(26,39,68,0.25)]"
          : "border-[#e8ecf5] bg-white text-[#1a2744] hover:border-[#4caf72] hover:shadow-sm",
        is_shaking ? "animate-[shake_0.4s_ease-in-out]" : "",
      ].join(" ")}
    >
      {text}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds initial visible card set.
 * Takes up to 3 title cards and 3 description cards from the pool.
 * Tries to ensure each title has a matching description visible.
 */
function buildInitialVisible(pool: QuizCard[]): QuizCard[] {
  const titles = pool.filter((c) => c.card_type === "title").slice(0, 3);
  const logic_keys = new Set(titles.map((c) => c.logic_key));
  const descs = pool
    .filter((c) => c.card_type === "description" && logic_keys.has(c.logic_key))
    .slice(0, 3);

  return [...titles, ...descs];
}

/**
 * Replaces two matched cards with new cards from the pool.
 * Ensures the new pair (title + description) shares a logic_key.
 */
function replaceMatched(
  current: QuizCard[],
  card_a: QuizCard,
  card_b: QuizCard,
  pool: QuizCard[],
  ptr: React.MutableRefObject<number>
): QuizCard[] {
  const current_ids = new Set(current.map((c) => c.card_id));
  const removed_ids = new Set([card_a.card_id, card_b.card_id]);

  // Find next unused pair from pool
  let next_title: QuizCard | null = null;
  let next_desc: QuizCard | null = null;

  for (let i = 0; i < pool.length; i++) {
    const idx = (ptr.current + i) % pool.length;
    const card = pool[idx];
    if (current_ids.has(card.card_id) && !removed_ids.has(card.card_id)) continue;
    if (removed_ids.has(card.card_id)) continue;
    if (current_ids.has(card.card_id)) continue;

    if (!next_title && card.card_type === "title") {
      next_title = card;
    } else if (next_title && card.card_type === "description" && card.logic_key === next_title.logic_key) {
      next_desc = card;
      ptr.current = (idx + 1) % pool.length;
      break;
    }
  }

  const result = current.filter((c) => !removed_ids.has(c.card_id));
  if (next_title) result.push(next_title);
  if (next_desc) result.push(next_desc);

  return result;
}
