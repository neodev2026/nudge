/**
 * POST /api/v2/cron/marathon-nudge
 *
 * Sends nudge DMs/emails to users who have an in-progress marathon run.
 * One message per send-window slot per user per product.
 *
 * Send windows (user's local time): 06:00 / 09:00 / 12:00 / 15:00 / 18:00 / 21:00
 * Tolerance: ±15 minutes. Cron runs every 30 minutes.
 *
 * Per run:
 *   1. Check user is within a send window
 *   2. Skip if already sent in the same window today
 *   3. Sync cursor if user has advanced past it
 *   4. Fetch the card at cursor, build message, enqueue schedule
 *   5. Advance cursor by 1
 *
 * Security: Requires Authorization: Bearer {CRON_SECRET}
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/marathon-nudge";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function verifyCronSecret(request: Request): boolean {
  const auth = request.headers.get("Authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

// ---------------------------------------------------------------------------
// Named exports — pure utility functions (imported by unit tests)
// ---------------------------------------------------------------------------

const SEND_HOURS = [6, 9, 12, 15, 18, 21] as const;

/**
 * Extracts the local hour and minute for a UTC instant in the given timezone.
 * Normalises the rare "24" hour returned by some runtimes at midnight.
 */
export function getLocalTime(
  utc: Date,
  timezone: string
): { hour: number; minute: number } {
  const parts: Record<string, string> = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  })
    .formatToParts(utc)
    .forEach((p) => {
      parts[p.type] = p.value;
    });
  return {
    hour: parseInt(parts.hour, 10) % 24,
    minute: parseInt(parts.minute, 10),
  };
}

/**
 * Returns true when utcNow falls within ±toleranceMinutes of any send-window slot
 * in the user's local timezone.
 */
export function isWithinSendWindow(
  nowUtc: Date,
  timezone: string,
  toleranceMinutes = 15
): boolean {
  const { hour, minute } = getLocalTime(nowUtc, timezone);
  const total = hour * 60 + minute;
  return SEND_HOURS.some((h) => Math.abs(total - h * 60) <= toleranceMinutes);
}

/**
 * Returns true when sentAt and nowUtc fall in the same send-window slot
 * (same local calendar date + within ±toleranceMinutes of the same slot).
 *
 * Cross-date false-positives are prevented by comparing the local date string.
 */
export function isSameWindow(
  sentAt: Date,
  nowUtc: Date,
  timezone: string,
  toleranceMinutes = 15
): boolean {
  const localParts = (d: Date) => {
    const rec: Record<string, string> = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    })
      .formatToParts(d)
      .forEach((p) => {
        rec[p.type] = p.value;
      });
    const hour = parseInt(rec.hour, 10) % 24;
    return {
      date: `${rec.year}-${rec.month}-${rec.day}`,
      total: hour * 60 + parseInt(rec.minute, 10),
    };
  };

  const sent = localParts(sentAt);
  const now = localParts(nowUtc);

  if (sent.date !== now.date) return false;
  return Math.abs(sent.total - now.total) <= toleranceMinutes;
}

/**
 * Builds the nv2_schedules.message_body string for a marathon_nudge row.
 * Format: marathon:{slug}|{lastStageIndex}|{cursor}|{front}|{back}
 */
export function buildMarathonMessageBody(params: {
  slug: string;
  lastStageIndex: number;
  cursor: number;
  front: string;
  back: string;
}): string {
  const { slug, lastStageIndex, cursor, front, back } = params;
  return `marathon:${slug}|${lastStageIndex}|${cursor}|${front}|${back}`;
}

/**
 * Returns true when the nudge cursor is behind the user's actual progress and
 * needs to be fast-forwarded.
 *
 * @param cursor            Global card cursor (0-based flat index)
 * @param lastStageIndex    DB value: 0-based index of the next stage to start
 * @param stageCardCounts   Card count per stage, index 0 = first stage
 */
export function needsCursorSync(
  cursor: number,
  lastStageIndex: number,
  stageCardCounts: number[]
): boolean {
  let accumulated = 0;
  for (let i = 0; i < stageCardCounts.length; i++) {
    accumulated += stageCardCounts[i];
    if (cursor < accumulated) {
      // cursor is within stage i (0-based)
      return i < lastStageIndex;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  if (!verifyCronSecret(request)) {
    return routeData({ error: "Unauthorized" }, { status: 401 });
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { getMarathonStages, stageCardCountsFromStages, firstCardIndexOfStage, getCardAtCursor } =
    await import("~/features/v2/marathon/lib/queries.server");
  const { getLastMarathonNudge } = await import("../lib/queries.server");
  const { sendMarathonNudgeDm } = await import(
    "~/features/v2/auth/lib/discord.server"
  );
  const { sendMarathonNudgeEmail } = await import(
    "~/features/v2/auth/lib/email.server"
  );

  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const origin = new URL(request.url).origin;
  const nowUtc = new Date();

  const results = {
    enqueued: 0,
    skipped: 0,
    synced: 0,
    errors: [] as string[],
  };

  try {
    // 1. Fetch all in-progress runs with at least one stage done
    const { data: runs, error: runs_error } = await client
      .from("nv2_marathon_runs")
      .select("id, auth_user_id, product_id, last_stage_index, nudge_card_cursor")
      .eq("status", "in_progress")
      .gt("last_stage_index", 0);

    if (runs_error) throw new Error(runs_error.message);
    if (!runs || runs.length === 0) return routeData({ ok: true, results });

    // 2. Batch-fetch products and profiles for all unique IDs
    const unique_product_ids = [...new Set(runs.map((r) => r.product_id))];
    const unique_user_ids = [...new Set(runs.map((r) => r.auth_user_id))];

    const [
      { data: products },
      { data: profiles },
      { data: subs },
    ] = await Promise.all([
      client
        .from("nv2_learning_products")
        .select("id, name, slug")
        .in("id", unique_product_ids),
      client
        .from("nv2_profiles")
        .select(
          "auth_user_id, timezone, discord_id, email, discord_dm_unsubscribed, email_unsubscribed"
        )
        .in("auth_user_id", unique_user_ids),
      client
        .from("nv2_subscriptions")
        .select("auth_user_id, product_id")
        .in("auth_user_id", unique_user_ids)
        .in("product_id", unique_product_ids)
        .eq("is_active", true),
    ]);

    const product_map = new Map((products ?? []).map((p) => [p.id, p]));
    const profile_map = new Map((profiles ?? []).map((p) => [p.auth_user_id, p]));
    const sub_set = new Set(
      (subs ?? []).map((s) => `${s.auth_user_id}:${s.product_id}`)
    );

    // Cache stages per product to avoid redundant DB calls
    const stages_cache = new Map<string, Awaited<ReturnType<typeof getMarathonStages>>>();

    for (const run of runs) {
      const run_key = `${run.id}`;
      try {
        // Guard: active subscription required
        if (!sub_set.has(`${run.auth_user_id}:${run.product_id}`)) {
          results.skipped++;
          continue;
        }

        const product = product_map.get(run.product_id);
        const profile = profile_map.get(run.auth_user_id);
        if (!product || !profile) {
          results.skipped++;
          continue;
        }

        const tz = profile.timezone ?? "Asia/Seoul";

        // Guard: send window
        // if (!isWithinSendWindow(nowUtc, tz)) {
        //   results.skipped++;
        //   continue;
        // }

        // Guard: duplicate in same window
        const last_nudge = await getLastMarathonNudge(
          client as any,
          run.auth_user_id,
          product.slug
        );
        if (
          last_nudge &&
          isSameWindow(new Date(String(last_nudge.created_at)), nowUtc, tz)
        ) {
          results.skipped++;
          continue;
        }

        // Fetch (or reuse cached) stages for this product
        if (!stages_cache.has(run.product_id)) {
          stages_cache.set(
            run.product_id,
            await getMarathonStages(client as any, run.product_id)
          );
        }
        const stages = stages_cache.get(run.product_id)!;
        const card_counts = stageCardCountsFromStages(stages);

        // Cursor sync: fast-forward if user has progressed past cursor
        let cursor = (run as any).nudge_card_cursor as number ?? 0;
        const last_stage_index = run.last_stage_index;

        if (needsCursorSync(cursor, last_stage_index, card_counts)) {
          // Jump to first card of (last_stage_index + 1) stage — preview of next stage
          cursor = firstCardIndexOfStage(last_stage_index + 1, card_counts);
          await client
            .from("nv2_marathon_runs")
            .update({ nudge_card_cursor: cursor } as any)
            .eq("id", run.id);
          results.synced++;
        }

        // Fetch card at cursor
        const card = getCardAtCursor(stages, cursor);
        const front = card?.front ?? "";
        const back = card?.back ?? "";

        // run.id in URL acts as security token (no login required in messenger in-app browsers)
        const resume_url = `${origin}/products/${product.slug}/marathon/${run.id}/resume`;
        const message_body = buildMarathonMessageBody({
          slug: product.slug,
          lastStageIndex: last_stage_index,
          cursor,
          front,
          back,
        });

        const { error: insert_error } = await client
          .from("nv2_schedules")
          .insert({
            auth_user_id: run.auth_user_id,
            schedule_type: "marathon_nudge" as any,
            delivery_url: resume_url,
            message_body,
            scheduled_at: nowUtc.toISOString(),
            status: "pending",
          });

        if (insert_error) throw new Error(insert_error.message);

        // Advance cursor
        await client
          .from("nv2_marathon_runs")
          .update({ nudge_card_cursor: cursor + 1 } as any)
          .eq("id", run.id);

        results.enqueued++;
      } catch (err: any) {
        results.errors.push(`run ${run_key}: ${err?.message ?? "unknown"}`);
      }
    }
  } catch (err: any) {
    console.error("[cron/marathon-nudge] fatal:", err);
    return routeData({ error: err.message }, { status: 500 });
  }

  return routeData({ ok: true, results });
}
