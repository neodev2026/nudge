/**
 * POST /api/v2/hyper-sync/save-result
 *
 * Persists a single card verdict to nv2_hyper_sync_results.
 * Anonymous users (auth_user_id starting with "anon:") write through
 * the service-role client which bypasses RLS.
 *
 * Request body (JSON):
 *   {
 *     auth_user_id: string,    // 'anon:<uuid>' or Supabase auth.users.id
 *     product_id:   string,
 *     session_id:   string,
 *     card_id:      string,
 *     result:       'known' | 'unknown',
 *     session_date: string,    // 'YYYY-MM-DD' in user's local tz
 *   }
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/save-result";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import { saveHyperSyncResult } from "../lib/queries.server";

interface SaveResultBody {
  auth_user_id?: string;
  product_id?: string;
  session_id?: string;
  card_id?: string;
  result?: "known" | "unknown";
  session_date?: string;
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  let body: SaveResultBody;
  try {
    body = (await request.json()) as SaveResultBody;
  } catch {
    return routeData({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    auth_user_id,
    product_id,
    session_id,
    card_id,
    result,
    session_date,
  } = body;

  if (
    !auth_user_id ||
    !product_id ||
    !session_id ||
    !card_id ||
    !result ||
    !session_date
  ) {
    return routeData(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (result !== "known" && result !== "unknown") {
    return routeData({ error: "Invalid result" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(session_date)) {
    return routeData({ error: "Invalid session_date" }, { status: 400 });
  }

  const admin = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    await saveHyperSyncResult(admin as any, {
      authUserId: auth_user_id,
      productId: product_id,
      sessionId: session_id,
      cardId: card_id,
      result,
      sessionDate: session_date,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[hyper-sync/save-result] failed:", msg);
    return routeData({ error: msg }, { status: 500 });
  }

  return routeData({ ok: true });
}
