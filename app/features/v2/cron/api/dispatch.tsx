/**
 * POST /api/v2/cron/dispatch
 *
 * Processes pending rows in nv2_schedules where scheduled_at <= now().
 * Delivery channel resolution per schedule row:
 *
 *   1. discord_id present + discord_dm_unsubscribed = false  → Discord Bot DM
 *   2. discord_id absent  + email present + email_unsubscribed = false → Resend email
 *   3. cheer type with no discord_id → skip (cheer is Discord-only)
 *   4. otherwise → mark failed
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
  const { sendSessionEmail } = await import(
    "~/features/v2/auth/lib/email.server"
  );

  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results = {
    sent: 0,
    failed: 0,
    retrying: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    const pending = await getCronPendingSchedules(client as any);

    // Batch-fetch discord_id + email + unsubscribe flags for all unique users
    const unique_user_ids = [...new Set(pending.map((s) => s.auth_user_id))];
    const { data: profiles_raw } = await client
      .from("nv2_profiles")
      .select("auth_user_id, discord_id, email, discord_dm_unsubscribed, email_unsubscribed")
      .in("auth_user_id", unique_user_ids.length > 0 ? unique_user_ids : ["__none__"]);

    // Build lookup maps indexed by auth_user_id
    type ProfileRow = {
      auth_user_id: string;
      discord_id: string | null;
      email: string | null;
      discord_dm_unsubscribed: boolean;
      email_unsubscribed: boolean;
    };
    const profile_map: Record<string, ProfileRow> = {};
    for (const p of (profiles_raw ?? []) as ProfileRow[]) {
      profile_map[p.auth_user_id] = p;
    }

    for (const schedule of pending) {
      const schedule_id = schedule.schedule_id as unknown as bigint;
      const profile = profile_map[schedule.auth_user_id] ?? null;

      const discord_id = profile?.discord_id ?? null;
      const discord_unsubscribed = profile?.discord_dm_unsubscribed ?? false;
      const email = profile?.email ?? null;
      const email_unsubscribed = profile?.email_unsubscribed ?? false;

      // Resolve delivery channel
      const use_discord =
        discord_id !== null && !discord_unsubscribed;
      const use_email =
        !use_discord && email !== null && !email_unsubscribed;

      try {
        if (schedule.schedule_type === "cheer") {
          // Cheer messages are Discord-only — skip if no discord_id
          if (!use_discord) {
            await markCronScheduleSent(client as any, schedule_id);
            results.skipped++;
            continue;
          }

          const raw_body = schedule.message_body ?? "";

          // Split into meta+incomplete part and complete_message part by ||| separator
          const separator_idx = raw_body.indexOf("|||");
          const has_dual_message = separator_idx !== -1;

          const meta_part = has_dual_message
            ? raw_body.slice(0, separator_idx)
            : raw_body;
          const complete_message_part = has_dual_message
            ? raw_body.slice(separator_idx + 3)
            : null;

          // Parse meta: "cheer:HH|product_name|session_label|incomplete_message"
          // Legacy format (no product info): "cheer:HH|message"
          const parts = meta_part.split("|");
          let product_name = "";
          let session_label = "";
          let incomplete_message = "";
          if (parts.length >= 4) {
            product_name = parts[1] ?? "";
            session_label = parts[2] ?? "";
            incomplete_message = parts.slice(3).join("|");
          } else {
            incomplete_message = parts.slice(1).join("|");
          }

          let message = incomplete_message;

          if (has_dual_message && complete_message_part !== null) {
            // Re-check session status immediately before sending to handle
            // the case where the user completed the session after n8n enqueued it
            const { data: latest_session } = await client
              .from("nv2_sessions")
              .select("status")
              .eq("auth_user_id", schedule.auth_user_id)
              .not("status", "eq", "pending")
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const is_completed = latest_session?.status === "completed";
            message = is_completed ? complete_message_part : incomplete_message;
          }

          await sendCheerDm(
            discord_id!,
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

          if (use_discord) {
            await sendSessionDm(
              discord_id!,
              schedule.delivery_url,
              product_name,
              session_title,
              review_round
            );
          } else if (use_email) {
            await sendSessionEmail(
              email!,
              schedule.delivery_url,
              product_name,
              session_title,
              review_round
            );
          } else {
            throw new Error(
              `No delivery channel for auth_user_id=${schedule.auth_user_id}`
            );
          }
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
