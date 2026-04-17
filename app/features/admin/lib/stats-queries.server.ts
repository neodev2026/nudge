/**
 * Admin statistics queries for /admin/stats.
 *
 * All queries accept a DateRange parameter derived from the user-selected
 * date + timezone. The caller (loader) converts the local date to UTC
 * boundaries before passing them here.
 *
 * All queries use the service-role client (adminClient) — bypasses RLS.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

// ---------------------------------------------------------------------------
// Date range helpers
// ---------------------------------------------------------------------------

/**
 * Converts a local date string ("YYYY-MM-DD") and IANA timezone into
 * a UTC start/end range covering that full calendar day.
 *
 * Example:
 *   localDateToUtcRange("2026-04-17", "Asia/Seoul")
 *   → { start: "2026-04-16T15:00:00.000Z", end: "2026-04-17T15:00:00.000Z" }
 */
export function localDateToUtcRange(
  date_str: string, // "YYYY-MM-DD"
  timezone: string  // IANA, e.g. "Asia/Seoul"
): { start: string; end: string } {
  // Build a Date for midnight local time by parsing the offset at that instant.
  // We use Intl.DateTimeFormat to find the UTC offset in the given timezone.
  const midnight_local = new Date(`${date_str}T00:00:00`);

  // Get the UTC offset for this timezone on this date (in minutes)
  const offset_minutes = getUtcOffsetMinutes(midnight_local, timezone);

  // start = local midnight expressed in UTC
  const start = new Date(midnight_local.getTime() - offset_minutes * 60_000);
  // end   = next local midnight in UTC
  const end   = new Date(start.getTime() + 24 * 60 * 60_000);

  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Returns the UTC offset (in minutes) for a given timezone at a specific instant.
 * Positive = ahead of UTC (e.g. Asia/Seoul = +540).
 */
function getUtcOffsetMinutes(date: Date, timezone: string): number {
  // Format the date in both UTC and the target timezone, then diff
  const utc_str = date.toLocaleString("en-US", { timeZone: "UTC" });
  const local_str = date.toLocaleString("en-US", { timeZone: timezone });
  const utc_ms   = new Date(utc_str).getTime();
  const local_ms = new Date(local_str).getTime();
  return Math.round((local_ms - utc_ms) / 60_000);
}

/**
 * Returns an ISO string for N days before the given UTC start,
 * used for the 7-day trend window.
 */
function nDaysBeforeUtc(utc_start: string, n: number): string {
  const d = new Date(utc_start);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

/** Returns "YYYY-MM-DD" for a Date in UTC. */
function toUtcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Converts a UTC timestamp to a local "YYYY-MM-DD" key in the given timezone.
 */
function toLocalDateKey(utc_iso: string, timezone: string): string {
  return new Date(utc_iso).toLocaleDateString("sv-SE", { timeZone: timezone });
  // sv-SE locale returns "YYYY-MM-DD" format reliably
}

// ---------------------------------------------------------------------------
// Shared parameter type
// ---------------------------------------------------------------------------

export interface StatsDateRange {
  /** UTC ISO string for the start of the selected local day */
  day_start_utc: string;
  /** UTC ISO string for the end of the selected local day */
  day_end_utc: string;
  /** The user-facing local date string "YYYY-MM-DD" */
  local_date: string;
  /** IANA timezone */
  timezone: string;
}

/**
 * Builds a StatsDateRange from user inputs.
 * Falls back to today in Asia/Seoul if inputs are invalid.
 */
export function buildStatsDateRange(
  date_str: string | null,
  timezone: string | null
): StatsDateRange {
  const tz = isValidTimezone(timezone) ? timezone! : "Asia/Seoul";

  // Determine local "today" in the selected timezone
  const today_local = new Date().toLocaleDateString("sv-SE", { timeZone: tz });
  const local_date  = isValidDateStr(date_str) ? date_str! : today_local;

  const { start, end } = localDateToUtcRange(local_date, tz);

  return {
    day_start_utc: start,
    day_end_utc:   end,
    local_date,
    timezone: tz,
  };
}

function isValidTimezone(tz: string | null): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function isValidDateStr(s: string | null): boolean {
  if (!s) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

// ---------------------------------------------------------------------------
// Today KPI cards
// ---------------------------------------------------------------------------

export interface TodayStats {
  new_signups: number;
  active_sessions: number;
  completed_today: number;
  dm_sent_today: number;
}

export async function adminGetTodayStats(
  client: SupabaseClient<Database>,
  range: StatsDateRange
): Promise<TodayStats> {
  const { day_start_utc, day_end_utc } = range;

  const [
    { count: new_signups },
    { count: active_sessions },
    { count: completed_today },
    { count: dm_sent_today },
  ] = await Promise.all([
    // New signups on selected day
    client
      .from("nv2_profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", day_start_utc)
      .lt("created_at", day_end_utc),

    // Active sessions (pending + in_progress) — snapshot, not date-filtered
    client
      .from("nv2_sessions")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "in_progress"])
      .not("auth_user_id", "like", "anon:%"),

    // Sessions completed on selected day
    client
      .from("nv2_sessions")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", day_start_utc)
      .lt("completed_at", day_end_utc),

    // DMs / emails sent on selected day
    client
      .from("nv2_schedules")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", day_start_utc)
      .lt("sent_at", day_end_utc),
  ]);

  return {
    new_signups:    new_signups    ?? 0,
    active_sessions: active_sessions ?? 0,
    completed_today: completed_today ?? 0,
    dm_sent_today:  dm_sent_today  ?? 0,
  };
}

// ---------------------------------------------------------------------------
// 7-day daily trend
// ---------------------------------------------------------------------------

export interface DailyPoint {
  date: string;      // local "YYYY-MM-DD" in the selected timezone
  completed: number;
  signups: number;
}

export async function adminGetDailyTrend(
  client: SupabaseClient<Database>,
  range: StatsDateRange
): Promise<DailyPoint[]> {
  const { day_end_utc, timezone } = range;

  // Window: 7 local days ending at day_end_utc (includes selected day)
  const window_start_utc = nDaysBeforeUtc(range.day_start_utc, 6);

  const [{ data: completed_rows }, { data: signup_rows }] = await Promise.all([
    client
      .from("nv2_sessions")
      .select("completed_at")
      .eq("status", "completed")
      .gte("completed_at", window_start_utc)
      .lt("completed_at", day_end_utc)
      .not("auth_user_id", "like", "anon:%"),

    client
      .from("nv2_profiles")
      .select("created_at")
      .gte("created_at", window_start_utc)
      .lt("created_at", day_end_utc),
  ]);

  // Build map for the 7 local days in the selected timezone
  const map: Record<string, DailyPoint> = {};
  for (let i = 6; i >= 0; i--) {
    const utc_cursor = new Date(new Date(range.day_start_utc).getTime() - i * 24 * 60 * 60_000);
    const key = toLocalDateKey(utc_cursor.toISOString(), timezone);
    map[key] = { date: key, completed: 0, signups: 0 };
  }

  for (const row of completed_rows ?? []) {
    if (!row.completed_at) continue;
    const key = toLocalDateKey(String(row.completed_at), timezone);
    if (map[key]) map[key].completed++;
  }

  for (const row of signup_rows ?? []) {
    if (!row.created_at) continue;
    const key = toLocalDateKey(String(row.created_at), timezone);
    if (map[key]) map[key].signups++;
  }

  return Object.values(map);
}

// ---------------------------------------------------------------------------
// Per-product stats
// ---------------------------------------------------------------------------

export interface ProductStat {
  product_id: string;
  name: string;
  icon: string | null;
  slug: string;
  subscribers: number;
  active_sessions: number;
  completed_today: number;
}

export async function adminGetProductStats(
  client: SupabaseClient<Database>,
  range: StatsDateRange
): Promise<ProductStat[]> {
  const { day_start_utc, day_end_utc } = range;

  const [
    { data: products },
    { data: subs },
    { data: active_rows },
    { data: completed_rows },
  ] = await Promise.all([
    client
      .from("nv2_learning_products")
      .select("id, name, icon, slug")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),

    client
      .from("nv2_subscriptions")
      .select("product_id")
      .eq("is_active", true),

    client
      .from("nv2_sessions")
      .select("product_session_id, nv2_product_sessions!inner(product_id)")
      .in("status", ["pending", "in_progress"])
      .not("auth_user_id", "like", "anon:%"),

    client
      .from("nv2_sessions")
      .select("product_session_id, nv2_product_sessions!inner(product_id)")
      .eq("status", "completed")
      .gte("completed_at", day_start_utc)
      .lt("completed_at", day_end_utc)
      .not("auth_user_id", "like", "anon:%"),
  ]);

  if (!products || products.length === 0) return [];

  const sub_count: Record<string, number> = {};
  for (const s of subs ?? []) {
    sub_count[s.product_id] = (sub_count[s.product_id] ?? 0) + 1;
  }

  const active_count: Record<string, number> = {};
  for (const r of active_rows ?? []) {
    const pid = (r.nv2_product_sessions as any)?.product_id;
    if (pid) active_count[pid] = (active_count[pid] ?? 0) + 1;
  }

  const completed_count: Record<string, number> = {};
  for (const r of completed_rows ?? []) {
    const pid = (r.nv2_product_sessions as any)?.product_id;
    if (pid) completed_count[pid] = (completed_count[pid] ?? 0) + 1;
  }

  return products.map((p) => ({
    product_id:       p.id,
    name:             p.name,
    icon:             p.icon ?? null,
    slug:             p.slug,
    subscribers:      sub_count[p.id]      ?? 0,
    active_sessions:  active_count[p.id]   ?? 0,
    completed_today:  completed_count[p.id] ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Recent signups
// ---------------------------------------------------------------------------

export interface RecentSignup {
  auth_user_id: string;
  display_name: string | null;
  email: string | null;
  discord_id: string | null;
  created_at: string;
  product_names: string[];
}

export async function adminGetRecentSignups(
  client: SupabaseClient<Database>,
  limit = 10
): Promise<RecentSignup[]> {
  const { data: profiles } = await client
    .from("nv2_profiles")
    .select("auth_user_id, display_name, email, discord_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!profiles || profiles.length === 0) return [];

  const user_ids = profiles.map((p) => p.auth_user_id);

  const { data: subs } = await client
    .from("nv2_subscriptions")
    .select("auth_user_id, nv2_learning_products!inner(name)")
    .in("auth_user_id", user_ids)
    .eq("is_active", true);

  const product_map: Record<string, string[]> = {};
  for (const s of subs ?? []) {
    const name = (s.nv2_learning_products as any)?.name;
    if (name) {
      if (!product_map[s.auth_user_id]) product_map[s.auth_user_id] = [];
      product_map[s.auth_user_id].push(name);
    }
  }

  return profiles.map((p) => ({
    auth_user_id: p.auth_user_id,
    display_name: p.display_name ?? null,
    email:        (p as any).email       ?? null,
    discord_id:   (p as any).discord_id  ?? null,
    created_at: String(p.created_at),
    product_names: product_map[p.auth_user_id] ?? [],
  }));
}
