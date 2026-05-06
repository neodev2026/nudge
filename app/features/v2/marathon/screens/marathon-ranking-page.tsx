/**
 * /marathon-ranking
 *
 * Public marathon ranking page — no login required.
 * Shows learn and quiz rankings for the current or last season.
 * Viewport: mobile-first (375px).
 *
 * Query params:
 *   ?season=current (default) | last
 */
import type { Route } from "./+types/marathon-ranking-page";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { useState } from "react";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  getActiveSeasonId,
  getLastEndedSeason,
  getLearnRanking,
  getQuizRanking,
  type SeasonRow,
  type LearnRankRow,
  type QuizRankRow,
} from "~/features/v2/marathon/lib/ranking-queries.server";

export const meta: Route.MetaFunction = () => [
  { title: "마라톤 랭킹 — Nudge" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const seasonParam = url.searchParams.get("season") ?? "current";

  const [currentSeason, lastSeason] = await Promise.all([
    getActiveSeasonId(),
    getLastEndedSeason(),
  ]);

  const viewingSeason: SeasonRow | null =
    seasonParam === "last" ? lastSeason : currentSeason;

  let learnRanking: LearnRankRow[] = [];
  let quizRanking: QuizRankRow[] = [];

  if (viewingSeason) {
    [learnRanking, quizRanking] = await Promise.all([
      getLearnRanking(viewingSeason.id),
      getQuizRanking(viewingSeason.id),
    ]);
  }

  // Auth: ignore errors for public page
  let currentUserId: string | null = null;
  try {
    const [client] = makeServerClient(request);
    const { data } = await client.auth.getUser();
    currentUserId = data.user?.id ?? null;
  } catch {
    // unauthenticated — leave null
  }

  return {
    currentSeason,
    lastSeason,
    learnRanking,
    quizRanking,
    viewingSeason,
    currentUserId,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = "learn" | "quiz";

export default function MarathonRankingPage() {
  const {
    currentSeason,
    lastSeason,
    learnRanking,
    quizRanking,
    viewingSeason,
    currentUserId,
  } = useLoaderData<typeof loader>();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("learn");

  const seasonParam = searchParams.get("season") ?? "current";

  function switchSeason(next: "current" | "last") {
    navigate(`/marathon-ranking?season=${next}`, { replace: true });
  }

  return (
    <div className="mx-auto max-w-[480px] px-4 py-6 space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-[#1a2744]">🏆 마라톤 랭킹</h1>

      {/* Season info card */}
      {viewingSeason ? (
        <SeasonCard season={viewingSeason} isActive={seasonParam === "current" && !!currentSeason} />
      ) : (
        <div className="rounded-2xl border border-[#e8ecf5] bg-white p-4 text-sm text-[#6b7a99]">
          {seasonParam === "last"
            ? "지난 시즌 기록이 없습니다."
            : "현재 진행 중인 시즌이 없습니다."}
        </div>
      )}

      {/* Season toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => switchSeason("current")}
          disabled={!currentSeason}
          className={toggleClass(seasonParam === "current")}
        >
          현재 시즌
        </button>
        <button
          onClick={() => switchSeason("last")}
          disabled={!lastSeason}
          className={toggleClass(seasonParam === "last")}
        >
          지난 시즌
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e8ecf5]">
        <TabButton
          label="📚 학습 랭킹"
          active={activeTab === "learn"}
          onClick={() => setActiveTab("learn")}
        />
        <TabButton
          label="🎯 퀴즈 랭킹"
          active={activeTab === "quiz"}
          onClick={() => setActiveTab("quiz")}
        />
      </div>

      {/* Ranking content */}
      {!viewingSeason ? null : activeTab === "learn" ? (
        <LearnRankingTable rows={learnRanking} currentUserId={currentUserId} />
      ) : (
        <QuizRankingTable rows={quizRanking} currentUserId={currentUserId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Season card
// ---------------------------------------------------------------------------

function SeasonCard({
  season,
  isActive,
}: {
  season: SeasonRow;
  isActive: boolean;
}) {
  const start = new Date(String(season.starts_at));
  const end = new Date(String(season.ends_at));

  const daysLeft = isActive
    ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86_400_000))
    : null;

  const fmt = (d: Date) =>
    d.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  return (
    <div className="rounded-2xl border border-[#e8ecf5] bg-white p-4 space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[#1a2744]">{season.title}</span>
        {daysLeft !== null && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
            D-{daysLeft}일 남음
          </span>
        )}
      </div>
      <p className="text-xs text-[#6b7a99]">
        {fmt(start)} ~ {fmt(end)} ({season.timezone})
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Learn ranking table
// ---------------------------------------------------------------------------

function LearnRankingTable({
  rows,
  currentUserId,
}: {
  rows: LearnRankRow[];
  currentUserId: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#6b7a99]">
        아직 참여자가 없습니다. 마라톤을 시작해보세요! 🏃
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => {
        const isSelf = currentUserId && row.auth_user_id === currentUserId;
        return (
          <div
            key={row.auth_user_id}
            className={[
              "flex items-start gap-3 rounded-xl border border-[#e8ecf5] p-3",
              isSelf ? "bg-blue-50 border-blue-200" : "bg-white",
            ].join(" ")}
          >
            {/* Rank */}
            <span className="w-7 shrink-0 text-center text-lg leading-tight">
              {rankLabel(idx)}
            </span>

            {/* Avatar */}
            <Avatar name={row.display_name} url={row.avatar_url} />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#1a2744] truncate">
                {row.display_name || "—"}
              </p>
              {/* Product badges */}
              <div className="mt-1 flex flex-wrap gap-1">
                {row.product_points.map((pp) => (
                  <span
                    key={pp.product_id}
                    className="rounded-full bg-[#f4f6fb] px-2 py-0.5 text-xs text-[#6b7a99]"
                  >
                    {pp.product_name} · {pp.points}점
                  </span>
                ))}
              </div>
            </div>

            {/* Total points */}
            <span className="shrink-0 text-base font-bold text-[#1a2744]">
              {row.total_points}점
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiz ranking table
// ---------------------------------------------------------------------------

function QuizRankingTable({
  rows,
  currentUserId,
}: {
  rows: QuizRankRow[];
  currentUserId: string | null;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#6b7a99]">
        아직 참여자가 없습니다. 마라톤을 시작해보세요! 🏃
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => {
        const isSelf = currentUserId && row.auth_user_id === currentUserId;
        return (
          <div
            key={row.auth_user_id}
            className={[
              "flex items-center gap-3 rounded-xl border border-[#e8ecf5] p-3",
              isSelf ? "bg-blue-50 border-blue-200" : "bg-white",
            ].join(" ")}
          >
            {/* Rank */}
            <span className="w-7 shrink-0 text-center text-lg leading-tight">
              {rankLabel(idx)}
            </span>

            {/* Avatar */}
            <Avatar name={row.display_name} url={row.avatar_url} />

            {/* Name */}
            <p className="flex-1 min-w-0 text-sm font-semibold text-[#1a2744] truncate">
              {row.display_name || "—"}
            </p>

            {/* Stats */}
            <div className="shrink-0 text-right">
              <p className="text-base font-bold text-[#1a2744]">
                {row.best_score_pct}점
              </p>
              <p className="text-xs text-[#6b7a99]">{row.attempt_count}회</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small UI helpers
// ---------------------------------------------------------------------------

function rankLabel(zeroIdx: number): string {
  if (zeroIdx === 0) return "🥇";
  if (zeroIdx === 1) return "🥈";
  if (zeroIdx === 2) return "🥉";
  return String(zeroIdx + 1);
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = (name ?? "?")[0]?.toUpperCase() ?? "?";
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8ecf5] text-sm font-bold text-[#6b7a99]">
      {initial}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex-1 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "border-b-2 border-[#1a2744] text-[#1a2744]"
          : "text-[#6b7a99] hover:text-[#1a2744]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function toggleClass(active: boolean) {
  return [
    "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
    active
      ? "border-[#1a2744] bg-[#1a2744] text-white"
      : "border-[#e8ecf5] bg-white text-[#6b7a99] hover:border-[#1a2744] hover:text-[#1a2744]",
    "disabled:cursor-not-allowed disabled:opacity-40",
  ].join(" ");
}
