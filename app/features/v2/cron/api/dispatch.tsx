/**
 * POST /api/v2/cron/dispatch
 *
 * Processes pending rows in nv2_schedules where scheduled_at <= now().
 * Resolves discord_id from nv2_profiles for Discord DM delivery.
 *
 * Runs every 5 minutes via Supabase Cron.
 * Security: Requires Authorization: Bearer {CRON_SECRET}
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

    // Batch-fetch discord_id for all unique auth_user_ids in pending schedules
    const unique_user_ids = [...new Set(pending.map((s) => s.auth_user_id))];
    const { data: profiles_raw } = await client
      .from("nv2_profiles")
      .select("auth_user_id, discord_id")
      .in("auth_user_id", unique_user_ids.length > 0 ? unique_user_ids : ["__none__"]);

    const discord_id_map: Record<string, string | null> = {};
    for (const p of profiles_raw ?? []) {
      discord_id_map[p.auth_user_id] = (p as any).discord_id ?? null;
    }

    for (const schedule of pending) {
      const schedule_id = schedule.schedule_id as unknown as bigint;
      const discord_id = discord_id_map[schedule.auth_user_id] ?? null;

      try {
        if (!discord_id) {
          // TODO: email fallback — skip for now, mark as failed
          throw new Error(`No discord_id for auth_user_id=${schedule.auth_user_id}`);
        }

        if (schedule.schedule_type === "cheer") {
          // cheer message_body format: "cheer:HH|product_name|session_label|message"
          // Legacy format (no product info): "cheer:HH|message"
          const raw_body = schedule.message_body ?? "";
          const parts = raw_body.split("|");
          let product_name = "";
          let session_label = "";
          let message = "";
          if (parts.length >= 4) {
            product_name = parts[1] ?? "";
            session_label = parts[2] ?? "";
            message = parts.slice(3).join("|");
          } else {
            message = parts.slice(1).join("|");
          }

          await sendCheerDm(
            discord_id,
            schedule.delivery_url,
            message,
            product_name || undefined,
            session_label || undefined
          );
        } else {
          // new / review / welcome
          // message_body format: "product_name|session_title|kind"
          const raw_body = schedule.message_body ?? "";
          const parts = raw_body.split("|");
          let product_name = "";
          let session_title = "";
          let review_round: number | null = null;

          if (parts.length >= 3) {
            product_name = parts[0] ?? "";
            session_title = parts[1] ?? "";
            const kind = parts[2] ?? "new";
            if (kind.startsWith("review_")) {
              review_round = parseInt(kind.split("_")[1] ?? "1", 10);
            }
          } else {
            session_title = raw_body || "오늘의 학습";
          }

          await sendSessionDm(
            discord_id,
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
