/**
 * POST /api/v2/cron/dispatch
 *
 * Processes pending rows in nv2_schedules where scheduled_at <= now().
 * Dispatches each row to the appropriate SNS channel (Discord for MVP).
 *
 * Runs every 5 minutes via Supabase Cron.
 * Security: Requires Authorization: Bearer {CRON_SECRET}
 *
 * Flow per schedule row:
 *   1. Send DM via Discord Bot
 *   2. On success: mark status = 'sent'
 *   3. On failure: increment retry_count; mark 'failed' if exhausted
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/dispatch";

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
  const {
    getCronPendingSchedules,
    markCronScheduleSent,
    markCronScheduleFailedOrRetry,
  } = await import("../lib/queries.server");
  const { sendSessionDm, sendCheerDm } = await import(
    "~/features/v2/auth/lib/discord.server"
  );

  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results = {
    sent: 0,
    failed: 0,
    retrying: 0,
    errors: [] as string[],
  };

  try {
    const pending = await getCronPendingSchedules(client as any);

    for (const schedule of pending) {
      const schedule_id = schedule.schedule_id as unknown as bigint;

      try {
        if (schedule.schedule_type === "cheer") {
          // cheer message_body format: "cheer:HH|product_name|session_label|message"
          // Legacy format (no product info): "cheer:HH|message"
          const raw_body = schedule.message_body ?? "";
          const parts = raw_body.split("|");
          // parts[0] = "cheer:HH", parts[1..] = product_name?, session_label?, message
          let product_name = "";
          let session_label = "";
          let message = "";
          if (parts.length >= 4) {
            // New format: cheer:HH|product_name|session_label|message
            product_name = parts[1] ?? "";
            session_label = parts[2] ?? "";
            message = parts.slice(3).join("|");
          } else {
            // Legacy format: cheer:HH|message
            message = parts.slice(1).join("|");
          }

          await sendCheerDm(
            schedule.sns_id,
            schedule.delivery_url,
            message,
            product_name || undefined,
            session_label || undefined
          );
        } else {
          // new / review / welcome
          // message_body format: "product_name|session_title|kind"
          //   kind = "new" | "review_N" (N = round number)
          // Legacy format (no pipes): plain session title string
          const raw_body = schedule.message_body ?? "";
          const parts = raw_body.split("|");
          let product_name = "";
          let session_title = "";
          let review_round: number | null = null;

          if (parts.length >= 3) {
            // New structured format
            product_name = parts[0] ?? "";
            session_title = parts[1] ?? "";
            const kind = parts[2] ?? "new";
            if (kind.startsWith("review_")) {
              review_round = parseInt(kind.split("_")[1] ?? "1", 10);
            }
          } else {
            // Legacy: just a plain title
            session_title = raw_body || "오늘의 학습";
          }

          await sendSessionDm(
            schedule.sns_id,
            schedule.delivery_url,
            product_name,
            session_title,
            review_round
          );
        }

        await markCronScheduleSent(client as any, schedule_id);
        results.sent++;
      } catch (err: any) {
        const msg = err?.message ?? "unknown error";
        results.errors.push(`schedule ${schedule.schedule_id}: ${msg}`);

        const retry_count = schedule.retry_count ?? 0;
        const max_retries = schedule.max_retries ?? 3;

        await markCronScheduleFailedOrRetry(
          client as any,
          schedule_id,
          msg,
          retry_count,
          max_retries
        ).catch(() => {});

        if (retry_count + 1 >= max_retries) {
          results.failed++;
        } else {
          results.retrying++;
        }
      }
    }
  } catch (err: any) {
    console.error("[cron/dispatch] fatal:", err);
    return routeData({ error: err.message }, { status: 500 });
  }

  return routeData({ ok: true, results });
}
