/**
 * POST /api/v2/auth/delete-account
 *
 * Deletes the authenticated user's account and all associated data.
 *
 * Deletion order (FK dependencies respected):
 *   1. nv2_schedules
 *   2. nv2_quiz_results
 *   3. nv2_stage_progress
 *   4. nv2_sessions
 *   5. nv2_subscriptions
 *   6. nv2_profiles
 *   7. auth.users (via Supabase admin API)
 */
import type { Route } from "./+types/delete-account";
import { redirect } from "react-router";
import { data as routeData } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";

const TABLES_TO_DELETE = [
  "nv2_chat_turns",      // Leni AI chat message history
  "nv2_turn_balance",    // AI chat turn quota
  "nv2_schedules",       // DM delivery queue
  "nv2_quiz_results",    // Quiz scores and rankings
  "nv2_stage_progress",  // Per-card learning progress
  "nv2_sessions",        // Session history
  "nv2_subscriptions",   // Product subscriptions
  "nv2_profiles",        // Profile (name, email, discord_id)
] as const;

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client, headers] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return routeData({ error: "Unauthorized" }, { status: 401 });
  }

  const auth_user_id = user.id;

  // Sign out first to clear session cookies before deletion
  await client.auth.signOut();

  // Delete all user data in dependency order
  for (const table of TABLES_TO_DELETE) {
    const { error } = await adminClient
      .from(table as any)
      .delete()
      .eq("auth_user_id", auth_user_id);

    if (error) {
      console.error(`[delete-account] failed to delete from ${table}:`, error);
      // Continue — best effort deletion
    }
  }

  // Finally delete from Supabase auth.users
  const { error: auth_error } = await adminClient.auth.admin.deleteUser(auth_user_id);

  if (auth_error) {
    console.error("[delete-account] deleteUser failed:", auth_error);
    return routeData(
      { error: "계정 삭제 중 오류가 발생했습니다" },
      { status: 500, headers }
    );
  }

  return redirect("/", { headers });
}
