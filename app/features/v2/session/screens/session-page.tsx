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

  const { sns_type, sns_id, link_access } = identity;

  const { data: auth_session } = await client.auth.getSession();
  const auth_user = auth_session.session?.user ?? null;
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
        client, sns_type, sns_id, s.stage_id
      ).catch(() => null);
      return { stage_id: s.stage_id, completed: !!progress?.completed_at };
    })
  );

  const progress_map = Object.fromEntries(
    stage_progresses.map((p) => [p.stage_id, p.completed])
  );
  const completed_count = stage_progresses.filter((p) => p.completed).length;
  const all_completed = completed_count === stages.length && stages.length > 0;

  return {
    session_id: params.sessionId,
    session_title,
    session_number: product_session.session_number,
    stages,
    progress_map,
    completed_count,
    total_count: stages.length,
    all_completed,
    is_authenticated,
    sns_type,
    sns_id,
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
    is_authenticated,
    link_access,
  } = useLoaderData<typeof loader>();

  const complete_fetcher = useFetcher<{ ok?: boolean; next_session_id?: string | null }>();
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

  const is_done = !!complete_data?.ok;
  const next_session_id = complete_data?.next_session_id ?? null;

  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      {/* Header */}
      <div className="border-b border-[#1a2744]/[0.07] bg-white/70 px-6 py-5 backdrop-blur-sm">
        <div className="mx-auto max-w-lg">
          <Link
            to="/products"
            className="text-xs font-semibold text-[#6b7a99] hover:text-[#1a2744]"
          >
            ← 상품 목록
          </Link>
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
              {next_session_id ? (
                <>
                  <p className="mt-1 text-sm text-[#6b7a99]">
                    다음 세션 링크를 Discord로 보내드렸어요!
                    <br />
                    아니면 여기서 바로 시작할까요?
                  </p>
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
  quiz_daily: "퀴즈",
  quiz_final: "최종 퀴즈",
  welcome: "안내",
  congratulations: "축하",
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
  const is_quiz = stage_type.startsWith("quiz");

  return (
    <Link
      to={
        is_quiz
          ? `/quiz/${stage_id}?session=${session_id}`
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
          {is_quiz && " · 매칭 게임"}
        </p>
      </div>

      {/* Arrow */}
      <span className="text-sm text-[#6b7a99]">→</span>
    </Link>
  );
}
