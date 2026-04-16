/**
 * /products/:slug/progress
 *
 * My Progress — per-product learning dashboard.
 *
 * Sections:
 *   1. Summary card (completion rate, streak, word count, last studied)
 *   2. Review status distribution (mastered / in-review / pending)
 *   3. Activity heatmap (last 12 weeks)
 *   4. Weak words top 5 (highest retry_count)
 *   5. Upcoming reviews (today / tomorrow / this week)
 *   6. Session timeline (unified, dm_sent_at DESC, new + review merged)
 *
 * Auth: Discord login required.
 * RLS: nv2_sessions select_own requires authenticated user.
 * All heavy queries use adminClient (service_role) to bypass RLS safely on server.
 */
import { useLoaderData, Link } from "react-router";
import { useState } from "react";
import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { createClient: createSupabase } = await import("@supabase/supabase-js");
  const adminClient = createSupabase(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Auth check
  const makeServerClient = (await import("~/core/lib/supa-client.server")).default;
  const [client] = makeServerClient(request);
  const { data: { user: auth_user } } = await client.auth.getUser();

  if (!auth_user) {
    const next = encodeURIComponent(`/products/${params.slug}/progress`);
    throw redirect(`/auth/discord/start?next=${next}`);
  }

  const auth_user_id = auth_user.id;

  // Product info
  const { data: product } = await adminClient
    .from("nv2_learning_products")
    .select("id, name, slug, icon, total_stages, meta")
    .eq("slug", params.slug!)
    .eq("is_active", true)
    .single();

  if (!product) throw new Response("Not Found", { status: 404 });

  // Total product sessions count
  const { count: total_sessions_count } = await adminClient
    .from("nv2_product_sessions")
    .select("id", { count: "exact", head: true })
    .eq("product_id", product.id)
    .eq("is_active", true);

  // User's completed sessions for this product
  const { data: user_sessions_raw } = await adminClient
    .from("nv2_sessions")
    .select(`
      session_id,
      status,
      session_kind,
      review_round,
      completed_at,
      started_at,
      dm_sent_at,
      product_session_id,
      nv2_product_sessions!inner(session_number, title, product_id)
    `)
    .eq("auth_user_id", auth_user_id)
    .eq("nv2_product_sessions.product_id", product.id)
    .order("dm_sent_at", { ascending: false });

  const user_sessions = user_sessions_raw ?? [];

  // Completed new sessions
  const completed_new = user_sessions.filter(
    (s) => s.status === "completed" && s.session_kind === "new"
  );

  // --- Streak calculation ---
  const completed_dates = completed_new
    .map((s) => s.completed_at ? new Date(s.completed_at).toLocaleDateString("en-CA") : null)
    .filter((d): d is string => !!d);
  const unique_dates = [...new Set(completed_dates)].sort().reverse();

  let streak = 0;
  const today = new Date().toLocaleDateString("en-CA");
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");
  let check = unique_dates[0] === today || unique_dates[0] === yesterday ? unique_dates[0] : null;
  for (const d of unique_dates) {
    if (d === check) {
      streak++;
      const prev = new Date(new Date(check).getTime() - 86400000).toLocaleDateString("en-CA");
      check = prev;
    } else break;
  }

  const last_studied = completed_new[0]?.completed_at
    ? new Date(completed_new[0].completed_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    : null;

  // --- Heatmap: last 84 days (12 weeks) ---
  const heatmap_start = new Date(Date.now() - 83 * 86400000).toLocaleDateString("en-CA");
  const heatmap_counts: Record<string, number> = {};
  for (const s of completed_new) {
    if (!s.completed_at) continue;
    const d = new Date(s.completed_at).toLocaleDateString("en-CA");
    if (d >= heatmap_start) heatmap_counts[d] = (heatmap_counts[d] ?? 0) + 1;
  }

  // --- Review status distribution ---
  // Get all learning stage IDs for this product
  const { data: stage_ids_raw } = await adminClient
    .from("nv2_stages")
    .select("id")
    .eq("learning_product_id", product.id)
    .eq("stage_type", "learning")
    .eq("is_active", true);

  const stage_ids = (stage_ids_raw ?? []).map((s) => s.id);

  const { data: all_progress } = stage_ids.length > 0
    ? await adminClient
        .from("nv2_stage_progress")
        .select("stage_id, review_status, retry_count, completed_at, nv2_stages!inner(title)")
        .eq("auth_user_id", auth_user_id)
        .in("stage_id", stage_ids)
    : { data: [] };

  const progress_rows = all_progress ?? [];

  const review_dist = {
    mastered: progress_rows.filter((p) => p.review_status === "mastered").length,
    in_review: progress_rows.filter((p) => ["r1_pending","r2_pending","r3_pending","r4_pending"].includes(p.review_status)).length,
    completed: progress_rows.filter((p) => p.completed_at && p.review_status === "none").length,
    not_started: stage_ids.length - progress_rows.filter((p) => !!p.completed_at).length,
  };

  // --- Weak words top 5 ---
  const weak_words = progress_rows
    .filter((p) => p.retry_count > 0 && p.completed_at)
    .sort((a, b) => b.retry_count - a.retry_count)
    .slice(0, 5)
    .map((p) => ({
      title: (p.nv2_stages as any)?.title ?? "",
      retry_count: p.retry_count,
    }));

  // --- Upcoming reviews ---
  const now_ts = Date.now();
  const day_ms = 86400000;
  const { data: upcoming_raw } = await adminClient
    .from("nv2_stage_progress")
    .select("next_review_at")
    .eq("auth_user_id", auth_user_id)
    .in("stage_id", stage_ids.length > 0 ? stage_ids : ["00000000-0000-0000-0000-000000000000"])
    .not("next_review_at", "is", null)
    .gte("next_review_at", new Date(now_ts).toISOString())
    .lte("next_review_at", new Date(now_ts + 7 * day_ms).toISOString());

  const upcoming = upcoming_raw ?? [];
  const upcoming_today    = upcoming.filter((r) => new Date(r.next_review_at!).getTime() < now_ts + day_ms).length;
  const upcoming_tomorrow = upcoming.filter((r) => {
    const t = new Date(r.next_review_at!).getTime();
    return t >= now_ts + day_ms && t < now_ts + 2 * day_ms;
  }).length;
  const upcoming_week = upcoming.filter((r) => new Date(r.next_review_at!).getTime() >= now_ts + 2 * day_ms).length;

  // --- Product sessions with stage previews (for timeline word preview) ---
  const { data: all_product_sessions_raw } = await adminClient
    .from("nv2_product_sessions")
    .select(`
      id,
      session_number,
      title,
      nv2_product_session_stages(
        stage_id,
        display_order,
        nv2_stages!inner(title, stage_type)
      )
    `)
    .eq("product_id", product.id)
    .eq("is_active", true)
    .order("session_number", { ascending: true });

  const all_product_sessions = all_product_sessions_raw ?? [];

  // --- Unified timeline: all nv2_sessions for this product, sorted by dm_sent_at DESC ---
  // Deduplicate review sessions: same (product_session_id, review_round) keeps best row
  //   completed > in_progress > pending, latest dm_sent_at as tiebreaker
  const STATUS_PRIORITY: Record<string, number> = { completed: 3, in_progress: 2, pending: 1 };

  const dedup_map: Record<string, typeof user_sessions[number]> = {};
  for (const s of user_sessions) {
    const key = s.session_kind === "review"
      ? `review__${s.product_session_id}__${s.review_round ?? 1}`
      : `new__${s.product_session_id}`;
    const existing = dedup_map[key];
    if (!existing) {
      dedup_map[key] = s;
    } else {
      const cur_p = STATUS_PRIORITY[s.status] ?? 0;
      const ex_p  = STATUS_PRIORITY[existing.status] ?? 0;
      if (cur_p > ex_p) {
        dedup_map[key] = s;
      } else if (cur_p === ex_p && (s.dm_sent_at ?? "") > (existing.dm_sent_at ?? "")) {
        dedup_map[key] = s;
      }
    }
  }

  // Build preview words map for new sessions: product_session_id → word titles
  const preview_map: Record<string, string[]> = {};
  for (const ps of all_product_sessions) {
    const titles = ((ps.nv2_product_session_stages ?? []) as any[])
      .filter((s: any) => s.nv2_stages?.stage_type === "learning")
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .slice(0, 3)
      .map((s: any) => s.nv2_stages?.title ?? "");
    preview_map[ps.id] = titles;
  }

  // product_session_id → session_number + title
  const ps_info_map: Record<string, { session_number: number; title: string }> = {};
  for (const ps of all_product_sessions) {
    ps_info_map[ps.id] = {
      session_number: ps.session_number,
      title: ps.title ?? `Session ${ps.session_number}`,
    };
  }

  const timeline = Object.values(dedup_map)
    .map((s) => {
      const ps_info = ps_info_map[s.product_session_id];
      return {
        session_id: s.session_id,
        product_session_id: s.product_session_id,
        session_number: ps_info?.session_number ?? 0,
        session_title: ps_info?.title ?? `Session ${(s.nv2_product_sessions as any)?.session_number ?? "?"}`,
        session_kind: s.session_kind as "new" | "review",
        review_round: s.review_round ?? null,
        status: s.status,
        dm_sent_at: s.dm_sent_at ?? null,
        completed_at: s.completed_at ?? null,
        preview_words: s.session_kind === "new" ? (preview_map[s.product_session_id] ?? []) : [],
      };
    })
    .sort((a, b) => (b.dm_sent_at ?? "").localeCompare(a.dm_sent_at ?? ""));

  return {
    product: { id: product.id, name: product.name, slug: product.slug, icon: product.icon, total_stages: product.total_stages },
    total_sessions: total_sessions_count ?? 0,
    completed_sessions: completed_new.length,
    streak,
    last_studied,
    heatmap_counts,
    review_dist,
    weak_words,
    upcoming_today,
    upcoming_tomorrow,
    upcoming_week,
    timeline,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProgressPage() {
  const {
    product,
    total_sessions,
    completed_sessions,
    streak,
    last_studied,
    heatmap_counts,
    review_dist,
    weak_words,
    upcoming_today,
    upcoming_tomorrow,
    upcoming_week,
    timeline,
  } = useLoaderData<typeof loader>();

  const completion_pct = total_sessions > 0
    ? Math.round((completed_sessions / total_sessions) * 100)
    : 0;

  // Learned words = completed learning stages (approximated by completed sessions × 5)
  const learned_words = completed_sessions * 5;

  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      {/* Header */}
      <div className="border-b border-[#1a2744]/[0.07] bg-white/70 px-6 py-4 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <Link
            to={`/products/${product.slug}`}
            className="text-sm font-semibold text-[#6b7a99] hover:text-[#1a2744]"
          >
            ← {product.name}
          </Link>
          <span className="text-sm font-extrabold text-[#1a2744]">My Progress</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* ── 1. Summary Card ── */}
        <section className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(26,39,68,0.08)]">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#6b7a99] mb-1">
                {product.icon ?? "📚"} {product.name}
              </p>
              <p className="font-display text-3xl font-black text-[#1a2744]">
                {completion_pct}
                <span className="text-lg font-bold text-[#6b7a99]">%</span>
              </p>
              <p className="text-xs text-[#6b7a99] mt-0.5">전체 진행률</p>
            </div>
            <div className="text-right">
              {streak > 0 && (
                <div className="flex items-center gap-1 justify-end mb-2">
                  <span className="text-xl">🔥</span>
                  <span className="font-display text-xl font-black text-[#1a2744]">{streak}</span>
                  <span className="text-xs text-[#6b7a99]">일 연속</span>
                </div>
              )}
              {last_studied && (
                <p className="text-xs text-[#6b7a99]">최근 학습 {last_studied}</p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-[#e8ecf5] mb-4">
            <div
              className="h-full rounded-full bg-[#4caf72] transition-all duration-700"
              style={{ width: `${completion_pct}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "완료 세션", value: `${completed_sessions}`, unit: `/ ${total_sessions}` },
              { label: "학습 단어", value: learned_words.toLocaleString(), unit: "개" },
              { label: "완전 암기", value: review_dist.mastered.toLocaleString(), unit: "개" },
            ].map(({ label, value, unit }) => (
              <div key={label} className="rounded-2xl bg-[#fdf8f0] px-3 py-3 text-center">
                <p className="font-display text-lg font-black text-[#1a2744]">
                  {value}
                  <span className="text-xs font-normal text-[#6b7a99] ml-0.5">{unit}</span>
                </p>
                <p className="text-[10px] text-[#6b7a99] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 2. Review Status ── */}
        <section className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(26,39,68,0.08)]">
          <h2 className="font-display text-base font-black text-[#1a2744] mb-4">복습 현황</h2>
          <div className="space-y-3">
            {[
              { label: "완전 암기", count: review_dist.mastered, color: "#4caf72", bg: "#4caf72" },
              { label: "복습 진행 중", count: review_dist.in_review, color: "#5865F2", bg: "#5865F2" },
              { label: "학습 완료 (복습 대기)", count: review_dist.completed, color: "#f59e0b", bg: "#f59e0b" },
              { label: "미학습", count: review_dist.not_started, color: "#e8ecf5", bg: "#c3c9d5" },
            ].map(({ label, count, color, bg }) => {
              const total_for_bar = review_dist.mastered + review_dist.in_review + review_dist.completed + review_dist.not_started;
              const pct = total_for_bar > 0 ? Math.round((count / total_for_bar) * 100) : 0;
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: bg }} />
                      <span className="text-sm text-[#374151]">{label}</span>
                    </div>
                    <span className="text-sm font-bold text-[#1a2744]">{count.toLocaleString()}개</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#e8ecf5]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: bg }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 3. Heatmap ── */}
        <Heatmap heatmap_counts={heatmap_counts} />

        {/* ── 4. Weak Words ── */}
        {weak_words.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(26,39,68,0.08)]">
            <h2 className="font-display text-base font-black text-[#1a2744] mb-4">
              다시 보기 횟수가 많은 단어
            </h2>
            <div className="space-y-2.5">
              {weak_words.map((w, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-sm font-black text-[#c3c9d5] w-5">{i + 1}</span>
                    <span className="text-sm font-bold text-[#1a2744]">{w.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#6b7a99]">다시보기</span>
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-500">
                      {w.retry_count}회
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 5. Upcoming Reviews ── */}
        {(upcoming_today + upcoming_tomorrow + upcoming_week) > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(26,39,68,0.08)]">
            <h2 className="font-display text-base font-black text-[#1a2744] mb-4">곧 복습할 단어</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "오늘", count: upcoming_today, color: "text-red-500 bg-red-50" },
                { label: "내일", count: upcoming_tomorrow, color: "text-amber-500 bg-amber-50" },
                { label: "이번 주", count: upcoming_week, color: "text-blue-500 bg-blue-50" },
              ].map(({ label, count, color }) => (
                <div key={label} className={`rounded-2xl px-3 py-3 text-center ${color}`}>
                  <p className="font-display text-xl font-black">{count}</p>
                  <p className="text-[10px] font-bold mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 6. Timeline ── */}
        <SessionTimeline
          timeline={timeline}
          total_sessions={total_sessions}
        />

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

function Heatmap({ heatmap_counts }: { heatmap_counts: Record<string, number> }) {
  // Build 84-day grid (12 weeks × 7 days), Sunday-first
  const cells: Array<{ date: string; count: number }> = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toLocaleDateString("en-CA");
    cells.push({ date: d, count: heatmap_counts[d] ?? 0 });
  }

  // Pad to start on Sunday
  const first_dow = new Date(cells[0].date).getDay(); // 0=Sun
  const padded: Array<{ date: string; count: number } | null> = [
    ...Array.from({ length: first_dow }, () => null),
    ...cells,
  ];

  const max_count = Math.max(...cells.map((c) => c.count), 1);

  function getColor(count: number) {
    if (count === 0) return "#e8ecf5";
    const intensity = count / max_count;
    if (intensity < 0.3) return "#bbf7d0";
    if (intensity < 0.6) return "#4ade80";
    if (intensity < 0.85) return "#16a34a";
    return "#15803d";
  }

  const week_labels = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(26,39,68,0.08)]">
      <h2 className="font-display text-base font-black text-[#1a2744] mb-4">학습 기록 (최근 12주)</h2>
      <div className="flex gap-1 mb-1">
        {week_labels.map((l) => (
          <div key={l} className="flex-1 text-center text-[9px] text-[#9aa3b5]">{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {padded.map((cell, i) => (
          <div
            key={i}
            title={cell ? `${cell.date}: ${cell.count}세션` : ""}
            className="aspect-square rounded-sm transition-colors"
            style={{ background: cell ? getColor(cell.count) : "transparent" }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 justify-end">
        <span className="text-[9px] text-[#9aa3b5]">적음</span>
        {["#e8ecf5","#bbf7d0","#4ade80","#16a34a","#15803d"].map((c) => (
          <div key={c} className="w-3 h-3 rounded-sm" style={{ background: c }} />
        ))}
        <span className="text-[9px] text-[#9aa3b5]">많음</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SessionTimeline — unified, sorted by dm_sent_at DESC
// ---------------------------------------------------------------------------

const PAGE_SIZE = 15;

function SessionTimeline({
  timeline,
  total_sessions,
}: {
  timeline: Array<{
    session_id: string;
    product_session_id: string;
    session_number: number;
    session_title: string;
    session_kind: "new" | "review";
    review_round: number | null;
    status: string;
    dm_sent_at: string | null;
    completed_at: string | null;
    preview_words: string[];
  }>;
  total_sessions: number;
}) {
  const [visible_count, set_visible_count] = useState(PAGE_SIZE);
  const visible = timeline.slice(0, visible_count);

  function fmtDate(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
    });
  }

  function fmtDateFull(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  return (
    <section className="rounded-3xl bg-white shadow-[0_4px_24px_rgba(26,39,68,0.08)] overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-[#f4f6fb]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-black text-[#1a2744]">세션 타임라인</h2>
          <span className="text-xs text-[#6b7a99]">전체 {total_sessions}세션</span>
        </div>
        <p className="text-xs text-[#9aa3b5] mt-1">DM 발송 최신순 · 신규 + 복습 통합</p>
      </div>

      {/* Timeline rows */}
      {timeline.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-[#9aa3b5]">아직 시작된 세션이 없어요.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#f4f6fb]">
          {visible.map((item, i) => {
            const is_completed = item.status === "completed";
            const is_active    = item.status === "in_progress" || item.status === "pending";
            const is_review    = item.session_kind === "review";

            // Dot color
            const dot_class = is_completed
              ? "bg-[#4caf72] border-[#4caf72]"
              : is_active
              ? "bg-[#5865F2] border-[#5865F2]"
              : "bg-white border-[#d1d5db]";

            return (
              <div key={item.session_id} className="px-6 py-4">
                <div className="flex items-start gap-3">

                  {/* Timeline dot + vertical line */}
                  <div className="flex flex-col items-center pt-1 flex-shrink-0 w-3">
                    <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${dot_class}`} />
                    {i < visible.length - 1 && (
                      <div className="w-px flex-1 min-h-[28px] bg-[#e8ecf5] mt-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">

                    {/* Row 1: date + kind badge + session label */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {item.dm_sent_at && (
                        <span className="text-[10px] text-[#9aa3b5] flex-shrink-0">
                          {fmtDate(item.dm_sent_at)}
                        </span>
                      )}
                      {is_review ? (
                        <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-500 flex-shrink-0">
                          복습 {item.review_round}회차
                        </span>
                      ) : (
                        <span className="rounded-full bg-[#fdf8f0] px-1.5 py-0.5 text-[9px] font-bold text-[#6b7a99] flex-shrink-0">
                          신규
                        </span>
                      )}
                      <span className={[
                        "text-sm font-bold truncate",
                        is_completed || is_active ? "text-[#1a2744]" : "text-[#9aa3b5]",
                      ].join(" ")}>
                        {item.session_title}
                      </span>
                    </div>

                    {/* Row 2: preview words (new session only) */}
                    {!is_review && item.preview_words.length > 0 && (
                      <p className="text-xs text-[#9aa3b5] mb-2 truncate">
                        {item.preview_words.join(", ")}
                      </p>
                    )}

                    {/* Row 3: status + completed date + goto button */}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <div className="flex items-center gap-1.5">
                        {is_completed ? (
                          <>
                            <span className="text-[#4caf72] text-xs">✓</span>
                            <span className="text-xs text-[#9aa3b5]">
                              {fmtDateFull(item.completed_at)} 완료
                            </span>
                          </>
                        ) : is_active ? (
                          <span className="rounded-full bg-[#5865F2]/10 px-2 py-0.5 text-[10px] font-bold text-[#5865F2]">
                            진행 중
                          </span>
                        ) : null}
                      </div>

                      {/* Goto button */}
                      <Link
                        to={`/sessions/${item.session_id}/list`}
                        className={[
                          "flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all flex-shrink-0",
                          is_completed
                            ? "bg-[#fdf8f0] text-[#6b7a99] hover:bg-[#e8ecf5] hover:text-[#1a2744]"
                            : is_active
                            ? "bg-[#5865F2] text-white hover:bg-[#4752c4] shadow-sm"
                            : "bg-[#f4f6fb] text-[#c3c9d5] cursor-not-allowed pointer-events-none",
                        ].join(" ")}
                        onClick={!is_completed && !is_active ? (e) => e.preventDefault() : undefined}
                      >
                        {is_active ? "학습하기 →" : is_completed ? "다시 보기" : "🔒"}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Load more */}
          {visible_count < timeline.length && (
            <div className="px-6 py-4 text-center border-t border-[#f4f6fb]">
              <button
                onClick={() => set_visible_count((n) => n + PAGE_SIZE)}
                className="text-sm font-bold text-[#6b7a99] hover:text-[#1a2744] transition-colors"
              >
                더 보기 ({timeline.length - visible_count}개 남음) ↓
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
