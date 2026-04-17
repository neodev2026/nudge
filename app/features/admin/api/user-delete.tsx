/**
 * POST /admin/api/users/:authUserId/delete
 *
 * Admin-initiated account deletion.
 * Deletes all user data then removes from Supabase auth.users.
 *
 * Deletion order:
 *   1. nv2_schedules
 *   2. nv2_quiz_results
 *   3. nv2_stage_progress
 *   4. nv2_sessions
 *   5. nv2_subscriptions
 *   6. nv2_profiles
 *   7. auth.users
 */
import type { Route } from "./+types/user-delete";
import { data as routeData } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";

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

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const auth_user_id = params.authUserId;
  if (!auth_user_id) {
    return routeData({ error: "auth_user_id required" }, { status: 400 });
  }

  // Delete all user data in dependency order
  for (const table of TABLES_TO_DELETE) {
    const { error } = await adminClient
      .from(table as any)
      .delete()
      .eq("auth_user_id", auth_user_id);

    if (error) {
      console.error(`[admin/user-delete] failed to delete from ${table}:`, error);
      // Continue — best effort deletion
    }
  }

  // Delete from Supabase auth.users
  const { error: auth_error } = await adminClient.auth.admin.deleteUser(auth_user_id);

  if (auth_error) {
    console.error("[admin/user-delete] deleteUser failed:", auth_error);
    return routeData({ error: auth_error.message }, { status: 500 });
  }

  return routeData({ ok: true });
}
