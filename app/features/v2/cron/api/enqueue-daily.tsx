/**
 * POST /api/v2/cron/enqueue-daily
 *
 * Enqueues daily learning and review DMs for users whose local send_hour
 * falls within the current 30-minute window.
 *
 * Runs every 30 minutes via Supabase Cron.
 * Security: Requires Authorization: Bearer {CRON_SECRET}
 *
 * Per user, per active subscription:
 *   Case A: Incomplete session exists (pending/in_progress)
 *           → Re-enqueue the existing session link at today's send_hour
 *   Case B: No incomplete session, next unstarted product session exists
 *           → Create new nv2_sessions row + enqueue
 *   Case C: All sessions completed → skip (nothing to send)
 *
 * Review DMs:
 *   → stage progress rows with next_review_at <= tomorrow are enqueued
 *     as schedule_type='review'
 *
 * Duplicate guard:
 *   → Skip if a 'new' or 'review' schedule already exists for this user today
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/enqueue-daily";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import type { SnsType } from "~/features/v2/shared/types";
import {
  getProfilesInLocalTimeWindow,
  getCronActiveSessionsForUser,
  getCronUserSubscriptions,
  getCronNextUnstartedProductSession,
  createCronNewSession,
  createCronReviewSession,
  getCronScheduleExistsToday,
  insertCronSchedule,
  getCronStageProgressDueForReview,
  getProductSessionContainingStage,
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

/** Returns the local date prefix "YYYY-MM-DD" for a given timezone */
function getLocalDatePrefix(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // en-CA = YYYY-MM-DD
}

/** Builds the scheduled_at ISO string for today's send_hour in the user's timezone */
function buildScheduledAt(timezone: string, send_hour: number): string {
  const date_str = getLocalDatePrefix(timezone);
  // Convert local send_hour to UTC ISO string
  const local_str = `${date_str}T${String(send_hour).padStart(2, "0")}:00:00`;
  const local_date = new Date(
    new Date(local_str).toLocaleString("en-US", { timeZone: timezone })
  );
  // Use the Intl offset approach: find UTC equivalent
  const utc_offset_ms =
    new Date(local_str).getTime() -
    new Date(
      new Date(local_str).toLocaleString("en-US", { timeZone: "UTC" })
    ).getTime();
  const utc_date = new Date(new Date(local_str).getTime() - utc_offset_ms);
  return utc_date.toISOString();
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
  const now = new Date().toISOString();

  const results = {
    new_enqueued: 0,
    review_enqueued: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // --- New / incomplete session DMs ---
    // Find profiles whose local send_hour window is active right now
    // We check each profile's send_hour individually below
    const { data: all_profiles, error: profile_error } = await client
      .from("nv2_profiles")
      .select("sns_type, sns_id, timezone, send_hour")
      .eq("is_active", true);

    if (profile_error) throw profile_error;

    const now_date = new Date();

    for (const profile of all_profiles ?? []) {
      try {
        // Check if user's local time is within [send_hour:00, send_hour:29]
        const local_time_str = now_date.toLocaleString("en-US", {
          timeZone: profile.timezone,
          hour: "numeric",
          minute: "numeric",
          hour12: false,
        });
        const [local_h, local_m] = local_time_str.split(":").map(Number);
        if (local_h !== profile.send_hour || local_m >= 30) continue;

        const sns_type = profile.sns_type as SnsType;
        const sns_id = profile.sns_id;
        const date_prefix = getLocalDatePrefix(profile.timezone);
        const scheduled_at = buildScheduledAt(profile.timezone, profile.send_hour);

        // Duplicate guard: skip if already enqueued today
        const already_enqueued = await getCronScheduleExistsToday(
          client, sns_type, sns_id, "new", date_prefix
        );
        if (already_enqueued) {
          results.skipped++;
          continue;
        }

        const subscriptions = await getCronUserSubscriptions(client, sns_type, sns_id);

        for (const sub of subscriptions) {
          try {
            const active_sessions = await getCronActiveSessionsForUser(
              client, sns_type, sns_id
            );

            // Filter active sessions for this product
            const active_for_product = active_sessions.filter((s) => {
              const ps = s.nv2_product_sessions as any;
              return ps?.product_id === sub.product_id;
            });

            let session_id: string | null = null;
            let session_title = "오늘의 학습";

            if (active_for_product.length > 0) {
              // Case A: re-enqueue existing incomplete session
              const existing = active_for_product[0];
              session_id = existing.session_id;
              const ps = existing.nv2_product_sessions as any;
              session_title = ps?.title ?? session_title;
            } else {
              // Case B: create new session
              const next_ps = await getCronNextUnstartedProductSession(
                client, sns_type, sns_id, sub.product_id
              );
              if (!next_ps) continue; // Case C: all done

              const new_session = await createCronNewSession(
                client, sns_type, sns_id, next_ps.id, now
              );
              session_id = new_session.session_id;
              session_title = next_ps.title ?? session_title;
            }

            if (!session_id) continue;

            const delivery_url = `${origin}/sessions/${session_id}`;

            await insertCronSchedule(client, {
              sns_type,
              sns_id,
              schedule_type: "new",
              delivery_url,
              message_body: session_title,
              scheduled_at,
            });

            results.new_enqueued++;
          } catch (err: any) {
            results.errors.push(
              `new enqueue failed (${sns_id}/${sub.product_id}): ${err.message}`
            );
          }
        }
      } catch (err: any) {
        results.errors.push(`profile loop failed (${profile.sns_id}): ${err.message}`);
      }
    }

    // --- Review DMs ---
    const due_reviews = await getCronStageProgressDueForReview(client);

    // Group by (sns_type, sns_id, product_session_id)
    const review_map = new Map<
      string,
      {
        sns_type: SnsType;
        sns_id: string;
        timezone: string;
        send_hour: number;
        product_session_id: string;
        review_round: number;
        stage_ids: string[];
        session_title: string;
      }
    >();

    for (const row of due_reviews) {
      try {
        const pss = await getProductSessionContainingStage(client, row.stage_id).catch(() => null);
        if (!pss) continue;

        const ps = pss.nv2_product_sessions as any;
        const round = row.review_round ?? 1;
        const key = `${row.sns_type}:${row.sns_id}:${pss.product_session_id}`;

        // Find profile timezone
        const { data: profile_row } = await client
          .from("nv2_profiles")
          .select("timezone, send_hour")
          .eq("sns_type", row.sns_type)
          .eq("sns_id", row.sns_id)
          .maybeSingle();

        const timezone = profile_row?.timezone ?? "Asia/Seoul";
        const send_hour = profile_row?.send_hour ?? 5;

        if (!review_map.has(key)) {
          review_map.set(key, {
            sns_type: row.sns_type as SnsType,
            sns_id: row.sns_id,
            timezone,
            send_hour,
            product_session_id: pss.product_session_id,
            review_round: round,
            stage_ids: [],
            session_title: ps?.title ? `${round}차 복습 — ${ps.title}` : `${round}차 복습`,
          });
        }
        review_map.get(key)!.stage_ids.push(row.stage_id);
      } catch (err: any) {
        results.errors.push(`review grouping failed: ${err.message}`);
      }
    }

    for (const [, info] of review_map) {
      try {
        const date_prefix = getLocalDatePrefix(info.timezone);

        const already_enqueued = await getCronScheduleExistsToday(
          client, info.sns_type, info.sns_id, "review", date_prefix
        );
        if (already_enqueued) {
          results.skipped++;
          continue;
        }

        const review_session = await createCronReviewSession(
          client,
          info.sns_type,
          info.sns_id,
          info.product_session_id,
          info.review_round,
          now
        );

        const delivery_url = `${origin}/sessions/${review_session.session_id}`;
        const scheduled_at = buildScheduledAt(info.timezone, info.send_hour);

        await insertCronSchedule(client, {
          sns_type: info.sns_type,
          sns_id: info.sns_id,
          schedule_type: "review",
          delivery_url,
          message_body: info.session_title,
          scheduled_at,
          review_round: info.review_round,
        });

        results.review_enqueued++;
      } catch (err: any) {
        results.errors.push(`review enqueue failed: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error("[cron/enqueue-daily] fatal:", err);
    return routeData({ error: err.message }, { status: 500 });
  }

  return routeData({ ok: true, results });
}
