/**
 * @deprecated 2026-04-21
 * Superseded by n8n workflow: leni-cheer-dm-v2
 * This route is no longer called by Supabase Cron.
 * Kept for reference and manual testing purposes only.
 *
 * POST /api/v2/cron/enqueue-nudge
 *
 * Enqueues Leni cheer DMs for users who have an incomplete session
 * and whose local time matches one of the fixed nudge slots.
 *
 * Security: Requires Authorization: Bearer {CRON_SECRET}
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/enqueue-nudge";
import {
  NUDGE_SCHEDULE_TIMES,
  // getRandomNudgeMessage, // deprecated — removed with leni-cheer-dm-v2 migration
} from "~/features/v2/shared/constants";

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get("Authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
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

  // ?force=1 bypasses time slot check — for manual testing only
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";

  // Server-only imports inside action to prevent client bundle contamination
  const { createClient } = await import("@supabase/supabase-js");
  const {
    getCronUsersWithIncompleteSessions,
    getCronCheerExistsTodayForHour,
    insertCronSchedule,
  } = await import("../lib/queries.server");

  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const origin = new URL(request.url).origin;
  const now_date = new Date();
  const now_iso = now_date.toISOString();

  const results = {
    enqueued: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    const candidates = await getCronUsersWithIncompleteSessions(client as any);

    for (const candidate of candidates) {
      try {
        const { data: profile } = await client
          .from("nv2_profiles")
          .select("timezone")
          .eq("auth_user_id", candidate.auth_user_id)
          .maybeSingle();

        const timezone = profile?.timezone ?? "Asia/Seoul";

        // force=1: skip all time-based checks, use hour=0 as dummy slot
        let local_h = 0;
        let local_m = 0;
        if (!force) {
          const local_time_str = now_date.toLocaleString("en-US", {
            timeZone: timezone,
            hour: "numeric",
            minute: "numeric",
            hour12: false,
          });
          const parts = local_time_str.split(":").map(Number);
          local_h = parts[0] ?? 0;
          local_m = parts[1] ?? 0;
        }

        // No DMs after 22:00 local time (unless force)
        if (!force && local_h >= 22) { results.skipped++; continue; }

        const found_slot = force
          ? { hour: local_h, minute: 0 }  // force: bypass slot check
          : NUDGE_SCHEDULE_TIMES.find((slot) => {
              if (slot.hour !== local_h) return false;
              if (slot.minute === 0)  return local_m < 30;
              if (slot.minute === 30) return local_m >= 30;
              return false;
            });

        if (!found_slot) { results.skipped++; continue; }

        // Type is now guaranteed non-undefined
        const matched_slot: { hour: number; minute: number } = found_slot;

        const auth_user_id = candidate.auth_user_id;
        const date_prefix = getLocalDatePrefix(timezone);

        const already_cheered = !force && await getCronCheerExistsTodayForHour(
          client as any, auth_user_id, matched_slot.hour, date_prefix
        );
        if (already_cheered) { results.skipped++; continue; }

        // getRandomNudgeMessage removed — n8n workflow now generates messages
        const hour_tag = `cheer:${String(matched_slot.hour).padStart(2, "0")}`;
        const message_body = `${hour_tag}|(legacy fallback — see leni-cheer-dm-v2 n8n workflow)`;

        await insertCronSchedule(client as any, {
          auth_user_id,
          schedule_type: "cheer",
          delivery_url: `${origin}/sessions/${candidate.session_id}`,
          message_body,
          scheduled_at: now_iso,
        });

        results.enqueued++;
      } catch (err: any) {
        results.errors.push(`cheer enqueue failed (${candidate.auth_user_id}): ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error("[cron/enqueue-nudge] fatal:", err);
    return routeData({ error: err.message }, { status: 500 });
  }

  return routeData({ ok: true, results });
}
