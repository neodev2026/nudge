/**
 * POST /api/v2/cron/enqueue-nudge
 *
 * Enqueues Leni cheer DMs for users who have an incomplete session
 * and whose local time matches one of the fixed nudge slots:
 *   09:00 / 11:30 / 14:00 / 17:30 / 21:00
 *
 * Runs every 30 minutes via Supabase Cron.
 * Security: Requires Authorization: Bearer {CRON_SECRET}
 *
 * Duplicate guard:
 *   → Skips if a cheer schedule tagged with the same hour already exists today
 *   → message_body is stored as "cheer:HH|<message>" for dedup lookup
 *
 * Time constraint:
 *   → Does not enqueue if user's local time >= 22:00
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/enqueue-nudge";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import type { SnsType } from "~/features/v2/shared/types";
import { NUDGE_SCHEDULE_TIMES, getRandomNudgeMessage } from "~/features/v2/shared/constants";
import {
  getCronUsersWithIncompleteSessions,
  getCronCheerExistsTodayForHour,
  insertCronSchedule,
} from "../lib/queries.server";

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

function getLocalDatePrefix(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  if (!verifyCronSecret(request)) {
    return routeData({ error: "Unauthorized" }, { status: 401 });
  }

  const client = makeServiceClient();
  const origin = new URL(request.url).origin;
  const now_date = new Date();
  const now_iso = now_date.toISOString();

  const results = {
    enqueued: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    const candidates = await getCronUsersWithIncompleteSessions(client);

    for (const candidate of candidates) {
      try {
        // Fetch profile timezone
        const { data: profile } = await client
          .from("nv2_profiles")
          .select("timezone")
          .eq("sns_type", candidate.sns_type)
          .eq("sns_id", candidate.sns_id)
          .maybeSingle();

        const timezone = profile?.timezone ?? "Asia/Seoul";

        // Get user's current local time
        const local_time_str = now_date.toLocaleString("en-US", {
          timeZone: timezone,
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        });
        const [local_h, local_m] = local_time_str.split(":").map(Number);

        // No DMs after 22:00 local time
        if (local_h >= 22) {
          results.skipped++;
          continue;
        }

        // Check if current local time matches any nudge slot within a 30-min window
        const matched_slot = NUDGE_SCHEDULE_TIMES.find((slot) => {
          if (slot.hour !== local_h) return false;
          // For :00 slots, match minute 0~29
          // For :30 slots, match minute 30~59
          if (slot.minute === 0) return local_m < 30;
          if (slot.minute === 30) return local_m >= 30;
          return false;
        });

        if (!matched_slot) {
          results.skipped++;
          continue;
        }

        const sns_type = candidate.sns_type as SnsType;
        const sns_id = candidate.sns_id;
        const date_prefix = getLocalDatePrefix(timezone);

        // Duplicate guard: only one cheer per hour per day
        const already_cheered = await getCronCheerExistsTodayForHour(
          client, sns_type, sns_id, matched_slot.hour, date_prefix
        );
        if (already_cheered) {
          results.skipped++;
          continue;
        }

        const message = getRandomNudgeMessage(matched_slot.hour);
        const hour_tag = `cheer:${String(matched_slot.hour).padStart(2, "0")}`;
        const message_body = `${hour_tag}|${message}`;

        const delivery_url = `${origin}/sessions/${candidate.session_id}`;

        await insertCronSchedule(client, {
          sns_type,
          sns_id,
          schedule_type: "cheer",
          delivery_url,
          message_body,
          scheduled_at: now_iso,
        });

        results.enqueued++;
      } catch (err: any) {
        results.errors.push(`cheer enqueue failed (${candidate.sns_id}): ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error("[cron/enqueue-nudge] fatal:", err);
    return routeData({ error: err.message }, { status: 500 });
  }

  return routeData({ ok: true, results });
}
