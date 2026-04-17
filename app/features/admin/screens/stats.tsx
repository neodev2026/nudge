/**
 * /admin/stats
 *
 * Admin statistics dashboard.
 * Supports date + timezone selection via URL params:
 *   ?date=YYYY-MM-DD&tz=Asia/Seoul
 *
 * The loader converts the local date to a UTC range and passes it to all
 * query functions. The UI updates params via useNavigate (no full reload).
 */
import type { Route } from "./+types/stats";
import { useLoaderData, useNavigate } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import {
  buildStatsDateRange,
  adminGetTodayStats,
  adminGetDailyTrend,
  adminGetProductStats,
  adminGetRecentSignups,
} from "~/features/admin/lib/stats-queries.server";

// ---------------------------------------------------------------------------
// Timezone options shown in the selector
// ---------------------------------------------------------------------------

const TIMEZONE_OPTIONS = [
  { label: "서울 (KST, UTC+9)",   value: "Asia/Seoul" },
  { label: "도쿄 (JST, UTC+9)",   value: "Asia/Tokyo" },
  { label: "베를린 (CET, UTC+1)", value: "Europe/Berlin" },
  { label: "런던 (GMT, UTC+0)",   value: "Europe/London" },
  { label: "뉴욕 (EST, UTC-5)",   value: "America/New_York" },
  { label: "UTC",                  value: "UTC" },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "통계 — Nudge Admin" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const url    = new URL(request.url);
  const range  = buildStatsDateRange(
    url.searchParams.get("date"),
    url.searchParams.get("tz")
  );

  const [today_stats, daily_trend, product_stats, recent_signups] =
    await Promise.all([
      adminGetTodayStats(adminClient, range),
      adminGetDailyTrend(adminClient, range),
      adminGetProductStats(adminClient, range),
      adminGetRecentSignups(adminClient, 10),
    ]);

  return {
    range,
    today_stats,
    daily_trend,
    product_stats,
    recent_signups,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminStats() {
  const { range, today_stats, daily_trend, product_stats, recent_signups } =
    useLoaderData<typeof loader>();

  const navigate = useNavigate();

  // Update a single URL param and trigger loader reload
  function setParam(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    navigate(`/admin/stats?${params.toString()}`, { replace: true });
  }

  const is_today =
    range.local_date ===
    new Date().toLocaleDateString("sv-SE", { timeZone: range.timezone });

  return (
    <div className="p-8">
      {/* ── Header + controls ── */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-black text-[#1a2744]">
            통계
          </h1>
          <p className="mt-1 text-sm text-[#6b7a99]">
            {range.local_date}{" "}
            <span className="rounded bg-[#f4f6fb] px-1.5 py-0.5 text-xs font-semibold text-[#6b7a99]">
              {range.timezone}
            </span>
            {is_today && (
              <span className="ml-2 rounded-full bg-[#4caf72]/10 px-2 py-0.5 text-xs font-bold text-[#4caf72]">
                오늘
              </span>
            )}
          </p>
        </div>

        {/* Date + timezone controls */}
        <div className="flex items-center gap-3">
          {/* Timezone selector */}
          <select
            value={range.timezone}
            onChange={(e) => setParam("tz", e.target.value)}
            className="rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm font-semibold text-[#1a2744] focus:border-[#4caf72] focus:outline-none"
          >
            {TIMEZONE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Date picker */}
          <input
            type="date"
            value={range.local_date}
            max={new Date().toLocaleDateString("sv-SE", {
              timeZone: range.timezone,
            })}
            onChange={(e) => {
              if (e.target.value) setParam("date", e.target.value);
            }}
            className="rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm font-semibold text-[#1a2744] focus:border-[#4caf72] focus:outline-none"
          />

          {/* Today shortcut */}
          {!is_today && (
            <button
              onClick={() => {
                const params = new URLSearchParams();
                params.set("tz", range.timezone);
                navigate(`/admin/stats?${params.toString()}`, { replace: true });
              }}
              className="rounded-xl border border-[#e8ecf5] bg-white px-3 py-2 text-sm font-semibold text-[#6b7a99] transition-colors hover:bg-[#f4f6fb] hover:text-[#1a2744]"
            >
              오늘로
            </button>
          )}
        </div>
      </div>

      {/* ── Section 1: KPI cards ── */}
      <div className="mb-10 grid grid-cols-4 gap-4">
        <KpiCard
          icon="👤"
          label="신규 가입자"
          value={today_stats.new_signups}
          unit="명"
          color="green"
        />
        <KpiCard
          icon="📖"
          label="활성 세션"
          value={today_stats.active_sessions}
          unit="개"
          color="blue"
          note="현재 스냅샷"
        />
        <KpiCard
          icon="✅"
          label={is_today ? "오늘 완료 세션" : "완료 세션"}
          value={today_stats.completed_today}
          unit="개"
          color="green"
        />
        <KpiCard
          icon="📨"
          label={is_today ? "오늘 알림 발송" : "알림 발송"}
          value={today_stats.dm_sent_today}
          unit="건"
          color="purple"
        />
      </div>

      {/* ── Section 2: 7-day trend ── */}
      <div className="mb-10 rounded-2xl border border-[#e8ecf5] bg-white p-6">
        <h2 className="mb-1 font-display text-base font-black text-[#1a2744]">
          최근 7일 추이
        </h2>
        <p className="mb-5 text-xs text-[#6b7a99]">
          {range.timezone} 기준 · 선택 날짜 포함 이전 7일
        </p>
        <TrendChart data={daily_trend} />
      </div>

      {/* ── Section 3: Per-product stats ── */}
      <div className="mb-10">
        <h2 className="mb-4 font-display text-base font-black text-[#1a2744]">
          상품별 현황
        </h2>
        <div className="overflow-hidden rounded-2xl border border-[#e8ecf5] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e8ecf5] bg-[#f4f6fb]">
                {[
                  "상품",
                  "구독자",
                  "활성 세션",
                  is_today ? "오늘 완료" : "당일 완료",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8ecf5]">
              {product_stats.map((p) => (
                <tr key={p.product_id} className="hover:bg-[#f4f6fb]">
                  <td className="px-5 py-3.5 font-semibold text-[#1a2744]">
                    {p.icon && <span className="mr-2">{p.icon}</span>}
                    {p.name}
                  </td>
                  <td className="px-5 py-3.5 text-[#1a2744]">
                    {p.subscribers.toLocaleString()}명
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={[
                        "rounded-full px-2.5 py-0.5 text-xs font-bold",
                        p.active_sessions > 0
                          ? "bg-blue-50 text-blue-600"
                          : "text-[#b0b8cc]",
                      ].join(" ")}
                    >
                      {p.active_sessions.toLocaleString()}개
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={[
                        "rounded-full px-2.5 py-0.5 text-xs font-bold",
                        p.completed_today > 0
                          ? "bg-[#4caf72]/10 text-[#4caf72]"
                          : "text-[#b0b8cc]",
                      ].join(" ")}
                    >
                      {p.completed_today.toLocaleString()}개
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 4: Recent signups ── */}
      <div>
        <h2 className="mb-4 font-display text-base font-black text-[#1a2744]">
          최근 가입자
        </h2>
        <div className="overflow-hidden rounded-2xl border border-[#e8ecf5] bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e8ecf5] bg-[#f4f6fb]">
                {["사용자", "채널", "가입일시", "구독 상품"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8ecf5]">
              {recent_signups.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-8 text-center text-sm text-[#b0b8cc]"
                  >
                    가입자가 없습니다
                  </td>
                </tr>
              ) : (
                recent_signups.map((u) => (
                  <tr key={u.auth_user_id} className="hover:bg-[#f4f6fb]">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-[#1a2744]">
                        {u.display_name ?? u.auth_user_id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-[#6b7a99]">{u.email ?? "—"}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.discord_id ? (
                        <span className="inline-flex items-center rounded-full bg-[#5865f2]/10 px-2.5 py-0.5 text-xs font-bold text-[#5865f2]">
                          Discord
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[#f4f6fb] px-2.5 py-0.5 text-xs font-bold text-[#6b7a99]">
                          Email
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#6b7a99]">
                      {formatDatetime(u.created_at, range.timezone)}
                    </td>
                    <td className="px-5 py-3.5">
                      {u.product_names.length === 0 ? (
                        <span className="text-xs text-[#b0b8cc]">없음</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.product_names.map((name) => (
                            <span
                              key={name}
                              className="rounded-full bg-[#1a2744]/5 px-2 py-0.5 text-xs font-semibold text-[#1a2744]"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KpiCard
// ---------------------------------------------------------------------------

const COLOR_MAP = {
  green:  { bg: "bg-[#4caf72]/10", text: "text-[#4caf72]" },
  blue:   { bg: "bg-blue-50",      text: "text-blue-600" },
  purple: { bg: "bg-purple-50",    text: "text-purple-600" },
  orange: { bg: "bg-orange-50",    text: "text-orange-600" },
};

function KpiCard({
  icon,
  label,
  value,
  unit,
  color,
  note,
}: {
  icon: string;
  label: string;
  value: number;
  unit: string;
  color: keyof typeof COLOR_MAP;
  note?: string;
}) {
  const c = COLOR_MAP[color];
  return (
    <div className="rounded-2xl border border-[#e8ecf5] bg-white p-5">
      <div className={["mb-3 inline-flex rounded-xl p-2.5", c.bg].join(" ")}>
        <span className="text-xl leading-none">{icon}</span>
      </div>
      <p className="text-xs font-semibold text-[#6b7a99]">
        {label}
        {note && (
          <span className="ml-1.5 rounded bg-[#f4f6fb] px-1 py-0.5 text-[10px] text-[#b0b8cc]">
            {note}
          </span>
        )}
      </p>
      <p className="mt-1 font-display text-3xl font-black text-[#1a2744]">
        {value.toLocaleString()}
        <span className="ml-1 text-sm font-semibold text-[#6b7a99]">{unit}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrendChart — pure SVG, no external dependencies
// ---------------------------------------------------------------------------

function TrendChart({
  data,
}: {
  data: { date: string; completed: number; signups: number }[];
}) {
  const W = 600;
  const H = 160;
  const PAD = { top: 12, right: 16, bottom: 32, left: 36 };

  const chart_w = W - PAD.left - PAD.right;
  const chart_h = H - PAD.top - PAD.bottom;

  const max_val = Math.max(...data.flatMap((d) => [d.completed, d.signups]), 1);

  const bar_group_w = chart_w / data.length;
  const bar_w = Math.min(18, bar_group_w * 0.38);
  const gap = 3;

  const grid_ratios = [0, 0.5, 1];

  function barX(i: number, offset: number): number {
    return PAD.left + bar_group_w * i + bar_group_w / 2 - bar_w - gap / 2 + offset;
  }

  function barH(val: number): number {
    return Math.max(2, (val / max_val) * chart_h);
  }

  function barY(val: number): number {
    return PAD.top + chart_h - barH(val);
  }

  // "MM/DD" short label
  function shortDate(iso: string): string {
    const [, m, d] = iso.split("-");
    return `${parseInt(m)}/${parseInt(d)}`;
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-5">
        <LegendDot color="#4caf72" label="완료 세션" />
        <LegendDot color="#5865f2" label="신규 가입" />
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ maxHeight: 200 }}
        aria-label="최근 7일 추이 차트"
      >
        {/* Grid lines + Y labels */}
        {grid_ratios.map((r, i) => {
          const y = PAD.top + chart_h * (1 - r);
          const label =
            i === 0 ? "0" : i === 1 ? Math.round(max_val / 2) : max_val;
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="#e8ecf5"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="#b0b8cc"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Bars + X labels */}
        {data.map((d, i) => (
          <g key={d.date}>
            <rect
              x={barX(i, 0)}
              y={barY(d.completed)}
              width={bar_w}
              height={barH(d.completed)}
              rx={3}
              fill="#4caf72"
              opacity={0.85}
            />
            <rect
              x={barX(i, bar_w + gap)}
              y={barY(d.signups)}
              width={bar_w}
              height={barH(d.signups)}
              rx={3}
              fill="#5865f2"
              opacity={0.75}
            />
            <text
              x={PAD.left + bar_group_w * i + bar_group_w / 2}
              y={H - PAD.bottom + 14}
              textAnchor="middle"
              fontSize={10}
              fill="#6b7a99"
            >
              {shortDate(d.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs text-[#6b7a99]">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a UTC ISO string into a local datetime string for display.
 * Uses the selected admin timezone.
 */
function formatDatetime(iso: string, timezone: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      timeZone: timezone,
      month:  "2-digit",
      day:    "2-digit",
      hour:   "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}
