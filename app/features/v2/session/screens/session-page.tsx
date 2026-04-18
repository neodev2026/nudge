/**
 * /sessions/:sessionId/list
 *
 * Session list page.
 *
 * Stage completion determination:
 *   신규 세션: completed = !!progress.completed_at
 *   복습 세션: completed = last_review_completed_at >= session.created_at
 *             (이번 복습 세션이 시작된 이후에 복습 완료가 찍혔는지 확인)
 *
 * This prevents review sessions from immediately auto-completing because
 * completed_at was already set during the original learning session.
 */
import type { Route } from "./+types/session-page";

import { Link, useLoaderData, useFetcher } from "react-router";
import { redirect } from "react-router";
import { useEffect } from "react";
import React from "react";

import makeServerClient from "~/core/lib/supa-client.server";
import {
  getNv2ProductSessionWithStages,
  startNv2UserSession,
  getSessionIdentity,
} from "~/features/v2/session/lib/queries.server";
import { getNv2StageProgress } from "~/features/v2/stage/lib/queries.server";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = ({ matches }) => {
  const loader_data = matches.find(
    (m) => m?.id === "routes/sessions/:sessionId/list"
  )?.data as Awaited<ReturnType<typeof loader>> | undefined;

  return [
    {
      title: loader_data
        ? `${loader_data.session_title} — Nudge`
        : "학습 세션 — Nudge",
    },
  ];
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);

  const identity = await getSessionIdentity(client, params.sessionId);
  if (!identity) throw new Response("Session not found", { status: 404 });

  const { auth_user_id, link_access, session_kind, review_round } = identity;
  const is_review = session_kind === "review";

  const { data: { user: auth_user } } = await client.auth.getUser();
  const is_authenticated = !!auth_user;

  if (link_access === "members_only" && !is_authenticated) {
    const next = encodeURIComponent(`/sessions/${params.sessionId}/list`);
    throw redirect(`/auth/discord/start?next=${next}`);
  }

  const product_session = await getNv2ProductSessionWithStages(
    client,
    identity.product_session_id
  );
  if (!product_session) throw new Response("Product session not found", { status: 404 });

  const session_title =
    product_session.title ?? `Session ${product_session.session_number}`;

  if (identity.status === "pending") {
    await startNv2UserSession(client, params.sessionId).catch(() => null);
  }

  // Fetch session created_at for review completion baseline.
  // In a review session, a stage is "done" only if its review timestamp
  // (last_review_completed_at for learning, completed_at for others)
  // is strictly AFTER the session row was created.
  // We normalise both sides to ISO strings via new Date() to avoid
  // string-format mismatches from the Supabase JS client.
  let session_created_at_ms: number | null = null;
  if (is_review) {
    const { data: session_row } = await client
      .from("nv2_sessions")
      .select("created_at")
      .eq("session_id", params.sessionId)
      .maybeSingle();
    if (session_row?.created_at) {
      const ms = new Date(String(session_row.created_at)).getTime();
      if (!isNaN(ms)) session_created_at_ms = ms;
    }
  }

  const stages = product_session.nv2_product_session_stages ?? [];

  const stage_progresses = await Promise.all(
    stages.map(async (s) => {
      const progress = await getNv2StageProgress(
        client, auth_user_id, s.stage_id
      ).catch(() => null);

      const stage_type = (s.nv2_stages as any)?.stage_type ?? "";
      const is_learning_stage = stage_type === "learning";

      let completed = false;
      let review_completed_in_session = false;

      if (is_review) {
        if (session_created_at_ms === null) {
          // Could not parse session timestamp — safe default: not completed
          completed = false;
          review_completed_in_session = false;
        } else {
          // All stage types use last_review_completed_at in review sessions.
          // null lrca → not completed (covers the post-reset state).
          const lrca = progress?.last_review_completed_at;
          if (lrca != null) {
            const lrca_ms = new Date(String(lrca)).getTime();
            review_completed_in_session = !isNaN(lrca_ms) && lrca_ms > session_created_at_ms;
          }
          completed = review_completed_in_session;
        }
      } else {
        completed = !!progress?.completed_at;
      }

      return {
        stage_id: s.stage_id,
        completed,
        review_completed_in_session,
      };
    })
  );

  const progress_map = Object.fromEntries(
    stage_progresses.map((p) => [p.stage_id, p.completed])
  );
  // Tracks per-stage "done in THIS review session" for visual distinction
  const review_done_map = Object.fromEntries(
    stage_progresses.map((p) => [p.stage_id, p.review_completed_in_session])
  );

  const completed_count = stage_progresses.filter((p) => p.completed).length;
  const all_completed = completed_count === stages.length && stages.length > 0;

  const all_learning_completed =
    stages.length > 0 &&
    stages
      .filter((s) => (s.nv2_stages as any)?.stage_type === "learning")
      .every((s) => progress_map[s.stage_id] ?? false);

  return {
    session_id: params.sessionId,
    session_title,
    session_number: product_session.session_number,
    session_kind: session_kind as "new" | "review",
    review_round: review_round as number | null,
    // session_status: used to prevent auto-complete firing when session was
    // already marked completed in a previous visit (e.g. after reset).
    session_status: identity.status,
    stages,
    progress_map,
    review_done_map,
    completed_count,
    total_count: stages.length,
    all_completed,
    all_learning_completed,
    is_authenticated,
    auth_user_id,
    is_anonymous: auth_user_id.startsWith("anon:"),
    link_access,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SessionPage() {
  const {
    session_id,
    session_title,
    session_number,
    session_kind,
    review_round,
    session_status,
    stages,
    progress_map,
    review_done_map,
    completed_count,
    total_count,
    all_completed,
    all_learning_completed,
    is_authenticated,
    is_anonymous,
    auth_user_id,
    link_access,
  } = useLoaderData<typeof loader>();

  const is_review = session_kind === "review";

  const complete_fetcher = useFetcher<{
    ok?: boolean;
    next_session_id?: string | null;
    is_anonymous?: boolean;
  }>();
  const is_completing = complete_fetcher.state !== "idle";
  const complete_data = complete_fetcher.data;

  // ── Auto-complete when all stages are done ────────────────────────────────
  // Guard: skip if the session was already "completed" in the DB when the
  // page loaded. This prevents the auto-complete from firing on page reload
  // after a reset, when the loader sees all_completed = true but the session
  // status was just reset to "in_progress" — a brief timing window could
  // still deliver a stale "completed" status. Using the DB status as an
  // additional gate makes the guard robust.
  const already_completed_in_db = session_status === "completed";

  useEffect(() => {
    if (all_completed && !complete_data && !is_completing && !already_completed_in_db) {
      complete_fetcher.submit(
        {},
        {
          method: "POST",
          action: `/api/v2/sessions/${session_id}/complete`,
        }
      );
    }
  }, [all_completed]);

  // ── Force-complete ────────────────────────────────────────────────────────
  const [is_force_completing, set_is_force_completing] = React.useState(false);
  // Tracks whether force-complete has finished so is_done can fire
  // without waiting for a full loader revalidation.
  const [force_done, set_force_done] = React.useState(false);

  async function handleForceComplete() {
    if (!auth_user_id || is_force_completing) return;
    set_is_force_completing(true);

    const incomplete_stage_ids = stages
      .filter((s) => !(progress_map[s.stage_id] ?? false))
      .map((s) => s.stage_id);

    await Promise.all(
      incomplete_stage_ids.map((stage_id) =>
        fetch(`/api/v2/stage/${stage_id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ auth_user_id }),
        })
      )
    );

    complete_fetcher.submit(
      {},
      { method: "POST", action: `/api/v2/sessions/${session_id}/complete` }
    );
    set_force_done(true);
  }

  const is_done = (!!complete_data?.ok && all_completed) || (force_done && !!complete_data?.ok);
  const next_session_id = complete_data?.next_session_id ?? null;

  // ── Leni guidance copy ────────────────────────────────────────────────────
  const leni_message_before = is_review
    ? `복습할 카드를 다시 학습해보세요! 반복이 기억을 만들어요 💪`
    : `아래의 모든 학습을 완료하세요!`;

  const leni_sub_before = is_review
    ? `이전에 배운 단어들이에요. 얼마나 기억하고 있는지 확인해봐요 🔁`
    : `순서대로 진행하면 더 효과적이에요 ✨`;

  const leni_message_after = is_review
    ? `복습 완료! 기억력이 점점 강해지고 있어요 🧠`
    : `모든 학습을 완료하셨네요! 🎉`;

  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      {/* ── Header ── */}
      <div className="border-b border-[#1a2744]/[0.07] bg-white/70 px-6 py-5 backdrop-blur-sm">
        <div className="mx-auto max-w-lg">
          <button
            onClick={() => window.history.back()}
            className="text-xs font-semibold text-[#6b7a99] hover:text-[#1a2744]"
          >
            ← 뒤로
          </button>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                {is_review && (
                  <span className="rounded-full bg-[#5865f2]/10 px-2.5 py-0.5 text-xs font-extrabold text-[#5865f2]">
                    🔁 복습 {review_round != null ? `${review_round}회차` : ""}
                  </span>
                )}
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#4caf72]">
                  Session {session_number}
                </p>
              </div>
              <h1 className="font-display text-xl font-black text-[#1a2744]">
                {session_title}
              </h1>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-black text-[#1a2744]">
                {completed_count}
                <span className="text-sm font-normal text-[#6b7a99]">
                  /{total_count}
                </span>
              </p>
              <p className="text-xs text-[#6b7a99]">완료</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#e8ecf5]">
            <div
              className="h-full rounded-full bg-[#4caf72] transition-all duration-500"
              style={{
                width: total_count > 0
                  ? `${(completed_count / total_count) * 100}%`
                  : "0%",
              }}
            />
          </div>
        </div>

        {/* Tab menu */}
        <div className="mx-auto flex max-w-lg border-t border-[#1a2744]/[0.06]">
          <div className="flex flex-1 items-center justify-center gap-1.5 border-b-2 border-[#1a2744] px-4 py-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#1a2744]">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-extrabold text-[#1a2744]">
              {is_review ? "복습 목록" : "학습 목록"}
            </span>
          </div>
          <Link
            to={`/sessions/${session_id}/chat`}
            className="flex flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent px-4 py-3 transition hover:border-[#c0589a]/40 hover:bg-[#fdf0f8]"
          >
            <img
              src="/images/leni/leni-chat-profile.png"
              alt="Leni"
              className="h-4 w-4 rounded-full object-cover"
            />
            <span className="text-xs font-bold text-[#6b7a99]">
              {is_review ? "Leni와 복습" : "Leni와 학습"}
            </span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6">
        {/* ── Leni + message ── */}
        <div className="flex flex-col items-center py-8 text-center">
          <div className="relative mb-4">
            <img
              src="/images/leni/leni-hero.png"
              alt="Leni"
              className={[
                "h-44 w-auto object-contain transition-all duration-500",
                is_done ? "drop-shadow-[0_8px_24px_rgba(76,175,114,0.35)]" : "",
              ].join(" ")}
            />
            {is_done && (
              <div className="absolute -top-2 -right-2 text-2xl animate-bounce">
                🌟
              </div>
            )}
          </div>

          {!is_done ? (
            <div>
              <p className="font-display text-lg font-black text-[#1a2744]">
                {leni_message_before}
              </p>
              <p className="mt-1 text-sm text-[#6b7a99]">{leni_sub_before}</p>
            </div>
          ) : (
            <div className="w-full">
              <p className="font-display text-lg font-black text-[#4caf72]">
                {leni_message_after}
              </p>
              {complete_data?.is_anonymous ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-[#6b7a99]">
                    체험이 끝났어요! 계속 학습하려면 회원가입이 필요합니다.
                  </p>
                  <Link
                    to="/join"
                    className="inline-block rounded-2xl bg-[#4caf72] px-8 py-3.5 text-sm font-extrabold text-white shadow-[0_4px_16px_rgba(76,175,114,0.30)] transition-all hover:-translate-y-px hover:bg-[#5ecb87]"
                  >
                    회원가입하고 계속 학습하기 →
                  </Link>
                  <p className="text-xs text-[#b0b8cc]">무료로 시작할 수 있어요</p>
                </div>
              ) : next_session_id ? (
                <>
                  {is_review && (
                    <p className="mt-1 mb-3 text-sm text-[#6b7a99]">
                      다음 세션이 준비되어 있어요. 계속 진행해봐요!
                    </p>
                  )}
                  <Link
                    to={`/sessions/${next_session_id}`}
                    className="mt-2 inline-block rounded-2xl bg-[#1a2744] px-8 py-3.5 text-sm font-extrabold text-white shadow-[0_4px_16px_rgba(26,39,68,0.20)] transition-all hover:-translate-y-px"
                  >
                    지금 바로 다음 세션 →
                  </Link>
                </>
              ) : (
                <p className="mt-1 text-sm text-[#6b7a99]">
                  {is_review
                    ? "모든 복습을 완료했어요! 🏆 꾸준히 반복하면 장기 기억이 돼요."
                    : "모든 학습을 완료했습니다! 🏆 수고하셨어요!"}
                </p>
              )}
            </div>
          )}

          {/* Force-complete */}
          {!is_done && all_learning_completed && !all_completed && (
            <button
              onClick={handleForceComplete}
              disabled={is_force_completing || is_completing}
              className="mt-4 w-full rounded-2xl border-2 border-dashed border-[#6b7a99]/40 bg-white px-6 py-3.5 text-sm font-bold text-[#6b7a99] transition-all hover:border-[#1a2744] hover:text-[#1a2744] disabled:opacity-50"
            >
              {is_force_completing
                ? "처리 중..."
                : is_review
                ? "퀴즈 건너뛰고 복습 완료 →"
                : "퀴즈 건너뛰고 다음 세션으로 →"}
            </button>
          )}

          {all_completed && is_completing && (
            <p className="mt-3 text-xs text-[#6b7a99] animate-pulse">
              완료 처리 중...
            </p>
          )}

          {/* Reset button for testing — always shown for non-anonymous users */}
          {!is_anonymous && (
            <ResetProgressButton
              session_id={session_id}
              auth_user_id={auth_user_id}
              is_review={is_review}
            />
          )}
        </div>

        {/* ── Stage list ── */}
        <div className="space-y-3 pb-10">
          {!is_authenticated && link_access === "members_only" && (
            <div className="rounded-2xl border border-[#5865F2]/20 bg-[#5865F2]/5 px-5 py-4 text-center mb-4">
              <p className="mb-3 text-sm text-[#6b7a99]">
                학습 기록을 저장하려면 Discord 로그인이 필요합니다.
              </p>
              <Link
                to="/auth/discord/start"
                className="inline-flex items-center gap-2 rounded-xl bg-[#5865F2] px-5 py-2.5 text-sm font-extrabold text-white"
              >
                Discord로 로그인
              </Link>
            </div>
          )}

          {stages.map((s, i) => {
            const stage = s.nv2_stages as any;
            if (!stage) return null;
            const is_completed = progress_map[s.stage_id] ?? false;
            const is_review_done = review_done_map[s.stage_id] ?? false;
            const first_incomplete_idx = stages.findIndex(
              (st) => !(progress_map[st.stage_id] ?? false)
            );
            const is_current = i === first_incomplete_idx;

            return (
              <StageRow
                key={s.stage_id}
                index={i + 1}
                stage_id={s.stage_id}
                title={stage.title}
                stage_type={stage.stage_type}
                is_completed={is_completed}
                is_current={is_current}
                is_review={is_review}
                is_review_done={is_review_done}
                session_id={session_id}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResetProgressButton — testing helper
// ---------------------------------------------------------------------------

function ResetProgressButton({
  session_id,
  auth_user_id,
  is_review,
}: {
  session_id: string;
  auth_user_id: string;
  is_review: boolean;
}) {
  const [resetting, set_resetting] = React.useState(false);
  const [done, set_done] = React.useState(false);

  async function handleReset() {
    if (resetting) return;
    const label = is_review ? "복습 상태" : "학습 상태";
    if (!window.confirm(`${label}를 초기화합니다. 계속할까요?`)) return;
    set_resetting(true);
    try {
      const url = `/api/v2/sessions/${session_id}/reset-progress`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auth_user_id, is_review }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`초기화 실패 (${res.status}): ${JSON.stringify(json)}`);
        set_resetting(false);
        return;
      }
      set_done(true);
      window.location.reload();
    } catch (err: any) {
      console.error("[reset] error:", err);
      alert(`초기화 오류: ${err?.message ?? err}`);
      set_resetting(false);
    }
  }

  return (
    <button
      onClick={handleReset}
      disabled={resetting || done}
      className="mt-3 w-full rounded-2xl border border-dashed border-red-200 bg-white px-6 py-2.5 text-xs font-bold text-red-400 transition-all hover:border-red-400 hover:text-red-600 disabled:opacity-40"
    >
      {resetting ? "초기화 중..." : is_review ? "복습 상태 초기화" : "학습 상태 초기화"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// StageRow
// ---------------------------------------------------------------------------

const STAGE_TYPE_LABELS: Record<string, string> = {
  learning: "학습",
  quiz_5: "퀴즈",
  quiz_10: "퀴즈",
  quiz_current_session: "퀴즈",
  quiz_current_and_prev_session: "퀴즈",
  quiz_daily: "퀴즈",
  quiz_final: "최종 퀴즈",
  welcome: "안내",
  congratulations: "축하",
  sentence_practice: "문장 연습",
  dictation: "받아쓰기",
  writing: "작문 연습",
};

function StageRow({
  index,
  stage_id,
  title,
  stage_type,
  is_completed,
  is_current,
  is_review,
  is_review_done,
  session_id,
}: {
  index: number;
  stage_id: string;
  title: string;
  stage_type: string;
  is_completed: boolean;
  is_current: boolean;
  is_review: boolean;
  is_review_done: boolean;
  session_id: string;
}) {
  const is_matching_quiz =
    stage_type === "quiz_10" || stage_type === "quiz_current_and_prev_session";
  const is_step_quiz =
    stage_type === "quiz_5" || stage_type === "quiz_current_session";
  const is_quiz = is_matching_quiz || is_step_quiz;
  const is_sentence = stage_type === "sentence_practice";
  const is_dictation = stage_type === "dictation";
  const is_writing = stage_type === "writing";

  // ── Visual state ──────────────────────────────────────────────────────────
  // Review session states:
  //   review_done  → indigo  (completed in this review)
  //   current      → navy    (next to complete)
  //   pending      → amber   (not yet done — needs revisiting)
  // New session states:
  //   completed    → green
  //   current      → navy
  //   locked       → faded

  const row_class = (() => {
    if (is_review) {
      if (is_review_done) return "border-[#5865f2]/25 bg-[#5865f2]/5";
      if (is_current)     return "border-[#1a2744] bg-white shadow-[0_4px_16px_rgba(26,39,68,0.10)]";
      return "border-amber-200 bg-amber-50/60";
    }
    if (is_completed) return "border-[#4caf72]/30 bg-[#4caf72]/5";
    if (is_current)   return "border-[#1a2744] bg-white shadow-[0_4px_16px_rgba(26,39,68,0.10)]";
    return "border-[#1a2744]/[0.07] bg-white opacity-60";
  })();

  const icon_class = (() => {
    if (is_review) {
      if (is_review_done) return "bg-[#5865f2] text-white";
      if (is_current)     return "bg-[#1a2744] text-white";
      return "bg-amber-100 text-amber-600";
    }
    if (is_completed) return "bg-[#4caf72] text-white";
    if (is_current)   return "bg-[#1a2744] text-white";
    return "bg-[#e8ecf5] text-[#6b7a99]";
  })();

  const title_class = (() => {
    if (is_review && is_review_done) return "text-[#5865f2]";
    if (!is_review && is_completed)  return "text-[#4caf72]";
    return "text-[#1a2744]";
  })();

  const icon_content = (() => {
    if (is_review && is_review_done) return "✓";
    if (!is_review && is_completed)  return "✓";
    if (is_review && !is_review_done) return "↺";
    return String(index);
  })();

  const sub_suffix = is_review
    ? is_review_done
      ? <span className="ml-1.5 text-[#5865f2]/70">· 복습 완료</span>
      : <span className="ml-1.5 text-amber-500">· 복습 필요</span>
    : null;

  return (
    <Link
      to={
        is_quiz
          ? `/quiz/${stage_id}?session=${session_id}`
          : is_sentence
          ? `/sentence/${stage_id}?session=${session_id}`
          : is_dictation
          ? `/dictation/${stage_id}?session=${session_id}`
          : is_writing
          ? `/writing/${stage_id}?session=${session_id}`
          : `/stages/${stage_id}?session=${session_id}`
      }
      className={[
        "flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all",
        row_class,
      ].join(" ")}
    >
      <div className={[
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black",
        icon_class,
      ].join(" ")}>
        {icon_content}
      </div>

      <div className="flex-1">
        <p className={["font-display font-extrabold", title_class].join(" ")}>
          {title}
        </p>
        <p className="text-xs text-[#6b7a99]">
          {STAGE_TYPE_LABELS[stage_type] ?? stage_type}
          {is_matching_quiz && " · 매칭 게임"}
          {is_step_quiz && " · 3단계 퀴즈"}
          {is_sentence && " · 문장 만들기"}
          {is_dictation && " · 듣고 받아쓰기"}
          {is_writing && " · 작문 + AI 피드백"}
          {sub_suffix}
        </p>
      </div>

      <span className="text-sm text-[#6b7a99]">→</span>
    </Link>
  );
}
