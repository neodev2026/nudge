/**
 * /sessions/:sessionId
 *
 * Session page — displays stages in order within a session.
 *
 * Access control (per subscription.link_access):
 *   public       — anyone with the link can view and complete stages.
 *                  sns_type/sns_id resolved from the session row itself.
 *   members_only — requires Discord OAuth login.
 *                  redirects to /auth/discord/start?next=/sessions/:id
 */
import type { Route } from "./+types/session-page";

import { Link, useLoaderData, useFetcher } from "react-router";
import { redirect } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import {
  getNv2ProductSessionWithStages,
  startNv2UserSession,
  getSessionIdentity,
} from "~/features/v2/session/lib/queries.server";
import { getNv2StageProgress } from "~/features/v2/stage/lib/queries.server";
import type { SnsType } from "~/features/v2/shared/types";

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

  // ── Resolve session identity (sns_type/sns_id from session row) ───────────
  const identity = await getSessionIdentity(client, params.sessionId);

  if (!identity) {
    throw new Response("Session not found", { status: 404 });
  }

  const { sns_type, sns_id, link_access } = identity;

  // ── Access control ────────────────────────────────────────────────────────
  const { data: auth_session } = await client.auth.getSession();
  const auth_user = auth_session.session?.user ?? null;
  const is_authenticated = !!auth_user;

  if (link_access === "members_only" && !is_authenticated) {
    // Redirect to Discord login, return to this session after auth
    const next = encodeURIComponent(`/sessions/${params.sessionId}`);
    throw redirect(`/auth/discord/start?next=${next}`);
  }

  // ── Load product session + stages ─────────────────────────────────────────
  const product_session = await getNv2ProductSessionWithStages(
    client,
    identity.product_session_id
  );

  if (!product_session) {
    throw new Response("Product session not found", { status: 404 });
  }

  const session_title =
    product_session.title ?? `Session ${product_session.session_number}`;

  // ── Mark session as in_progress on first open ─────────────────────────────
  // Works for both authenticated and public access
  if (identity.status === "pending") {
    await startNv2UserSession(client, params.sessionId).catch(() => null);
  }

  // ── Fetch progress for each stage ─────────────────────────────────────────
  const stages = product_session.nv2_product_session_stages ?? [];

  const stage_progresses = await Promise.all(
    stages.map(async (s) => {
      const progress = await getNv2StageProgress(
        client,
        sns_type,
        sns_id,
        s.stage_id
      ).catch(() => null);
      return {
        stage_id: s.stage_id,
        completed: !!progress?.completed_at,
      };
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
    // sns_type/sns_id from session row — available even without login (public)
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
  } = useLoaderData<typeof loader>();

  const complete_fetcher = useFetcher<{ ok?: boolean; next_session_id?: string | null }>();
  const is_completing = complete_fetcher.state !== "idle";
  const complete_data = complete_fetcher.data;

  function handleCompleteSession() {
    complete_fetcher.submit(
      {},
      {
        method: "POST",
        action: `/api/v2/sessions/${session_id}/complete`,
      }
    );
  }

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
            {/* Progress */}
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

      {/* Stage list */}
      <div className="mx-auto max-w-lg space-y-3 px-6 py-8">
        {stages.map((s, i) => {
          const stage = s.nv2_stages;
          if (!stage) return null;
          const is_completed = progress_map[s.stage_id] ?? false;

          // Find first incomplete stage to highlight as "current"
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
              is_authenticated={is_authenticated}
              session_id={session_id}
            />
          );
        })}

        {/* Session complete button */}
        {all_completed && !complete_data?.ok && (
          <div className="pt-4">
            <button
              onClick={handleCompleteSession}
              disabled={is_completing}
              className="w-full rounded-2xl bg-[#4caf72] py-4 text-base font-extrabold text-white shadow-[0_4px_16px_rgba(76,175,114,0.30)] transition-all hover:bg-[#5ecb87] disabled:opacity-60"
            >
              {is_completing ? "처리 중..." : "세션 완료 🎉"}
            </button>
          </div>
        )}

        {/* Complete result */}
        {complete_data?.ok && (
          <div className="rounded-2xl bg-[#4caf72]/10 px-6 py-6 text-center">
            <div className="mb-2 text-3xl">🎉</div>
            <p className="font-bold text-[#1a2744]">세션 완료!</p>
            <p className="mt-1 text-sm text-[#6b7a99]">
              {complete_data.next_session_id
                ? "Discord로 다음 세션 링크를 보내드렸어요!"
                : "모든 학습을 완료했습니다! 🏆"}
            </p>
            {complete_data.next_session_id && (
              <Link
                to={`/sessions/${complete_data.next_session_id}`}
                className="mt-4 inline-block rounded-xl bg-[#1a2744] px-6 py-3 text-sm font-extrabold text-white"
              >
                지금 바로 다음 세션 →
              </Link>
            )}
          </div>
        )}

        {/* Not authenticated notice */}
        {!is_authenticated && (
          <div className="rounded-2xl border border-[#5865F2]/20 bg-[#5865F2]/5 px-5 py-4 text-center">
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
  is_authenticated,
  session_id,
}: {
  index: number;
  stage_id: string;
  title: string;
  stage_type: string;
  is_completed: boolean;
  is_current: boolean;
  is_authenticated: boolean;
  session_id: string;
}) {
  const is_quiz = stage_type.startsWith("quiz");

  return (
    <Link
      to={`/stages/${stage_id}?session=${session_id}`}
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
