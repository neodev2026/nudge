/**
 * POST /api/v2/cron/daily-reset
 *
 * Resets today_new_count and today_review_count to 0 for users
 * whose local time is currently 00:00~00:29 (midnight window).
 *
 * Runs every 30 minutes via Supabase Cron.
 * Security: Requires Authorization: Bearer {CRON_SECRET}
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/daily-reset";

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

  // Server-only imports inside action to prevent client bundle contamination
  const { createClient } = await import("@supabase/supabase-js");
  const { resetCronDailyCounters } = await import("../lib/queries.server");

  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const result = await resetCronDailyCounters(client as any);
    return routeData({ ok: true, ...result });
  } catch (err: any) {
    console.error("[cron/daily-reset] failed:", err);
    return routeData({ error: err.message }, { status: 500 });
  }
}
