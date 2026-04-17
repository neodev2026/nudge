/**
 * /sessions/:sessionId
 *
 * Session page — redesigned layout:
 *   - Top: Leni image + guidance message
 *   - Bottom: stage list
 *   - No manual complete button — auto-completes when all stages done
 *
 * Auto-complete flow:
 *   Each stage completion → returns to session page
 *   → useEffect detects all_completed → auto-calls session complete API
 *   → complete_data received → shows completion message + next session button
 *
 * Access control (per subscription.link_access):
 *   public       — no login required, sns_id resolved from session row
 *   members_only — redirects to Discord login
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
    (m) => m?.id === "routes/sessions/:sessionId"
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

  const { auth_user_id, link_access } = identity;

  const { data: { user: auth_user } } = await client.auth.getUser();
  const is_authenticated = !!auth_user;

  if (link_access === "members_only" && !is_authenticated) {
    const next = encodeURIComponent(`/sessions/${params.sessionId}`);
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

  const stages = product_session.nv2_product_session_stages ?? [];

  const stage_progresses = await Promise.all(
    stages.map(async (s) => {
      const progress = await getNv2StageProgress(
        client, auth_user_id, s.stage_id
      ).catch(() => null);
      return { stage_id: s.stage_id, completed: !!progress?.completed_at };
    })
  );

  const progress_map = Object.fromEntries(
    stage_progresses.map((p) => [p.stage_id, p.completed])
  );
  const completed_count = stage_progresses.filter((p) => p.completed).length;
  const all_completed = completed_count === stages.length && stages.length > 0;

  // True when all learning stages are done (quiz/sentence stages may still be pending).
  // Used to show the optional "skip remaining & complete" button.
  const all_learning_completed =
    stages.length > 0 &&
    stages
      .filter((s) => (s.nv2_stages as any)?.stage_type === "learning")
      .every((s) => progress_map[s.stage_id] ?? false);

  return {
    session_id: params.sessionId,
    session_title,
    session_number: product_session.session_number,
    stages,
    progress_map,
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
    stages,
    progress_map,
    completed_count,
    total_count,
    all_completed,
    all_learning_completed,
    is_authenticated,
    is_anonymous,
    auth_user_id,
    link_access,
  } = useLoaderData<typeof loader>();

  const complete_fetcher = useFetcher<{ ok?: boolean; next_session_id?: string | null; is_anonymous?: boolean }>();
  const is_completing = complete_fetcher.state !== "idle";
  const complete_data = complete_fetcher.data;

  // ── Auto-complete when all stages are done ────────────────────────────────
  useEffect(() => {
    if (all_completed && !complete_data && !is_completing) {
      complete_fetcher.submit(
        {},
        {
          method: "POST",
          action: `/api/v2/sessions/${session_id}/complete`,
        }
      );
    }
  }, [all_completed]);

  // ── Force-complete: mark remaining stages done then complete session ──────
  // Shown when all learning stages are done but quiz/sentence stages remain.
  const force_fetcher = useFetcher();
  const [is_force_completing, set_is_force_completing] = React.useState(false);

  async function handleForceComplete() {
    if (!auth_user_id || is_force_completing) return;
    set_is_force_completing(true);

    // Mark every incomplete stage as complete via the existing stage API
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

    // Then trigger session complete
    complete_fetcher.submit(
      {},
      { method: "POST", action: `/api/v2/sessions/${session_id}/complete` }
    );
  }

  // Guard against stale fetcher data from previous session navigation.
  // all_completed ensures the completion state reflects the current session.
  const is_done = !!complete_data?.ok && all_completed;
  const next_session_id = complete_data?.next_session_id ?? null;

  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      {/* Header */}
      <div className="border-b border-[#1a2744]/[0.07] bg-white/70 px-6 py-5 backdrop-blur-sm">
        <div className="mx-auto max-w-lg">
          {/* Back button — browser history back */}
          <button
            onClick={() => window.history.back()}
            className="text-xs font-semibold text-[#6b7a99] hover:text-[#1a2744]"
          >
            ← 뒤로
          </button>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#4caf72]">
                Session {session_number}
              </p>
              <h1 className="font-display text-xl font-black text-[#1a2744]">
                {session_title}
              </h1>
            </div>
            {/* Progress count */}
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
          {/* 학습 목록 tab — active */}
          <div className="flex flex-1 items-center justify-center gap-1.5 border-b-2 border-[#1a2744] px-4 py-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#1a2744]">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-extrabold text-[#1a2744]">학습 목록</span>
          </div>
          {/* Leni와 학습 tab */}
          <Link
            to={`/sessions/${session_id}/chat`}
            className="flex flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent px-4 py-3 transition hover:border-[#c0589a]/40 hover:bg-[#fdf0f8]"
          >
            <img
              src="/images/leni/leni-chat-profile.png"
              alt="Leni"
              className="h-4 w-4 rounded-full object-cover"
            />
            <span className="text-xs font-bold text-[#6b7a99]">Leni와 학습</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-6">
        {/* ── Leni + message section ── */}
        <div className="flex flex-col items-center py-8 text-center">
          {/* Leni image */}
          <div className="relative mb-4">
            <img
              src="/images/leni/leni-hero.png"
              alt="Leni"
              className={[
                "h-44 w-auto object-contain transition-all duration-500",
                is_done ? "drop-shadow-[0_8px_24px_rgba(76,175,114,0.35)]" : "",
              ].join(" ")}
            />
            {/* Sparkle overlay on completion */}
            {is_done && (
              <div className="absolute -top-2 -right-2 text-2xl animate-bounce">
                🌟
              </div>
            )}
          </div>

          {/* Guidance message */}
          {!is_done ? (
            /* Before completion */
            <div>
              <p className="font-display text-lg font-black text-[#1a2744]">
                아래의 모든 학습을 완료하세요!
              </p>
              <p className="mt-1 text-sm text-[#6b7a99]">
                순서대로 진행하면 더 효과적이에요 ✨
              </p>
            </div>
          ) : (
            /* After completion */
            <div className="w-full">
              <p className="font-display text-lg font-black text-[#4caf72]">
                모든 학습을 완료하셨네요! 🎉
              </p>
              {complete_data?.is_anonymous ? (
                // Anonymous trial — prompt signup
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
                  <p className="text-xs text-[#b0b8cc]">
                    무료로 시작할 수 있어요
                  </p>
                </div>
              ) : next_session_id ? (
                <>
                  <Link
                    to={`/sessions/${next_session_id}`}
                    className="mt-4 inline-block rounded-2xl bg-[#1a2744] px-8 py-3.5 text-sm font-extrabold text-white shadow-[0_4px_16px_rgba(26,39,68,0.20)] transition-all hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(26,39,68,0.25)]"
                  >
                    지금 바로 다음 세션 →
                  </Link>
                </>
              ) : (
                <p className="mt-1 text-sm text-[#6b7a99]">
                  모든 학습을 완료했습니다! 🏆
                  <br />
                  수고하셨어요!
                </p>
              )}
            </div>
          )}

          {/* Force-complete button — shown when only quiz/sentence/welcome stages remain */}
          {!is_done && all_learning_completed && !all_completed && (
            <button
              onClick={handleForceComplete}
              disabled={is_force_completing || is_completing}
              className="mt-4 w-full rounded-2xl border-2 border-dashed border-[#6b7a99]/40 bg-white px-6 py-3.5 text-sm font-bold text-[#6b7a99] transition-all hover:border-[#1a2744] hover:text-[#1a2744] disabled:opacity-50"
            >
              {is_force_completing ? "처리 중..." : "퀴즈 건너뛰고 다음 세션으로 →"}
            </button>
          )}

          {/* Processing indicator */}
          {all_completed && is_completing && (
            <p className="mt-3 text-xs text-[#6b7a99] animate-pulse">
              완료 처리 중...
            </p>
          )}
        </div>

        {/* ── Stage list ── */}
        <div className="space-y-3 pb-10">
          {/* members_only login notice */}
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
  session_id,
}: {
  index: number;
  stage_id: string;
  title: string;
  stage_type: string;
  is_completed: boolean;
  is_current: boolean;
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
        is_completed
          ? "border-[#4caf72]/30 bg-[#4caf72]/5"
          : is_current
          ? "border-[#1a2744] bg-white shadow-[0_4px_16px_rgba(26,39,68,0.10)]"
          : "border-[#1a2744]/[0.07] bg-white opacity-60",
      ].join(" ")}
    >
      {/* Index / check */}
      <div
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black",
          is_completed
            ? "bg-[#4caf72] text-white"
            : is_current
            ? "bg-[#1a2744] text-white"
            : "bg-[#e8ecf5] text-[#6b7a99]",
        ].join(" ")}
      >
        {is_completed ? "✓" : index}
      </div>

      {/* Title */}
      <div className="flex-1">
        <p
          className={[
            "font-display font-extrabold",
            is_completed ? "text-[#4caf72]" : "text-[#1a2744]",
          ].join(" ")}
        >
          {title}
        </p>
        <p className="text-xs text-[#6b7a99]">
          {STAGE_TYPE_LABELS[stage_type] ?? stage_type}
          {is_matching_quiz && " · 매칭 게임"}
          {is_step_quiz && " · 3단계 퀴즈"}
          {is_sentence && " · 문장 만들기"}
          {is_dictation && " · 듣고 받아쓰기"}
          {is_writing && " · 작문 + AI 피드백"}
        </p>
      </div>

      {/* Arrow */}
      <span className="text-sm text-[#6b7a99]">→</span>
    </Link>
  );
}
