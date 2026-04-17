/**
 * POST /api/v2/cron/daily-reset
 *
 * Resets today_new_count and today_review_count to 0 for users
 * whose local time is currently 00:00~00:29 (midnight window).
 *
 * Also:
 *   - Purges stale nv2_chat_turns older than CHAT_TURN_RETENTION_DAYS (default 90)
 *   - Purges anonymous trial sessions older than ANON_SESSION_RETENTION_DAYS (default 7)
 *
 * Runs every 30 minutes via Supabase Cron.
 * Security: Requires Authorization: Bearer {CRON_SECRET}
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/daily-reset";

const ANON_SESSION_RETENTION_DAYS = 7;

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get("Authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  if (!verifyCronSecret(request)) {
    return routeData({ error: "Unauthorized" }, { status: 401 });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { resetCronDailyCounters, purgeStaleChatTurns } = await import("../lib/queries.server");

  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Cutoff date for anonymous session purge
    const anon_cutoff = new Date();
    anon_cutoff.setDate(anon_cutoff.getDate() - ANON_SESSION_RETENTION_DAYS);

    const [counters_result, retention_result, anon_result] = await Promise.all([
      resetCronDailyCounters(client as any),
      purgeStaleChatTurns(client as any),
      // Delete anonymous trial sessions older than retention period
      client
        .from("nv2_sessions")
        .delete()
        .like("auth_user_id", "anon:%")
        .lt("created_at", anon_cutoff.toISOString())
        .select("session_id"),
    ]);

    const anon_deleted = (anon_result.data ?? []).length;
    if (anon_result.error) {
      console.error("[daily-reset] anon session purge failed:", anon_result.error);
    }

    return routeData({
      ok: true,
      ...counters_result,
      ...retention_result,
      anon_sessions_deleted: anon_deleted,
    });
  } catch (err: any) {
    console.error("[cron/daily-reset] failed:", err);
    return routeData({ error: err.message }, { status: 500 });
  }
}
