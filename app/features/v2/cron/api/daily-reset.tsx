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

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import { resetCronDailyCounters } from "../lib/queries.server";

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get("Authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function makeServiceClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  if (!verifyCronSecret(request)) {
    return routeData({ error: "Unauthorized" }, { status: 401 });
  }

  const client = makeServiceClient();

  try {
    const result = await resetCronDailyCounters(client);
    return routeData({ ok: true, ...result });
  } catch (err: any) {
    console.error("[cron/daily-reset] failed:", err);
    return routeData({ error: err.message }, { status: 500 });
  }
}
