/**
 * POST /api/v2/hyper-sync/enqueue-review
 *
 * Inserts a hyper_sync_review row into nv2_schedules for tomorrow morning DM.
 * No-op for anonymous users — the action returns { skipped: true, reason }.
 *
 * Request body (JSON):
 *   {
 *     product_slug:     string,
 *     source_session_id: string,
 *     unknown_card_ids: string[],
 *   }
 *
 * Auth: requires a logged-in Supabase user. The user's auth_user_id and
 * timezone are read server-side from auth.getUser() and nv2_profiles.
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/enqueue-review";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import makeServerClient from "~/core/lib/supa-client.server";
import { enqueueHyperSyncReview } from "../lib/queries.server";

interface EnqueueBody {
  product_slug?: string;
  source_session_id?: string;
  unknown_card_ids?: string[];
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return routeData(
      { skipped: true, reason: "anonymous" },
      { status: 200 }
    );
  }

  let body: EnqueueBody;
  try {
    body = (await request.json()) as EnqueueBody;
  } catch {
    return routeData({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { product_slug, source_session_id, unknown_card_ids } = body;
  if (!product_slug || !source_session_id || !Array.isArray(unknown_card_ids)) {
    return routeData(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (unknown_card_ids.length === 0) {
    return routeData(
      { skipped: true, reason: "no_unknown_cards" },
      { status: 200 }
    );
  }

  const admin = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Read user timezone (defaults to Asia/Seoul if profile row missing).
  const { data: profile } = await admin
    .from("nv2_profiles")
    .select("timezone")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const timezone = profile?.timezone ?? "Asia/Seoul";
  const origin = new URL(request.url).origin;

  try {
    const { scheduleId } = await enqueueHyperSyncReview(admin as any, {
      authUserId: user.id,
      productSlug: product_slug,
      sourceSessionId: source_session_id,
      unknownCardIds: unknown_card_ids,
      timezone,
      origin,
    });

    if (scheduleId === null) {
      return routeData(
        { skipped: true, reason: "duplicate_or_empty_after_dedup" },
        { status: 200 }
      );
    }

    return routeData({
      ok: true,
      schedule_id: scheduleId.toString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[hyper-sync/enqueue-review] failed:", msg);
    return routeData({ error: msg }, { status: 500 });
  }
}
