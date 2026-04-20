/**
 * Admin authentication guards.
 *
 * requireAdmin() checks:
 *   1. User is authenticated (Supabase session exists)
 *   2. User email exists in the admins table
 *
 * Throws a redirect to /admin/login on any failure.
 */
import { redirect } from "react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

export async function requireAdmin(
  client: SupabaseClient<Database>,
  request: Request
) {
  // ── Step 1: Check authentication ─────────────────────────────────────────
  // Wrap getUser() to handle expired/invalid refresh tokens gracefully.
  // Supabase throws AuthApiError (refresh_token_not_found) instead of
  // returning null user when the stored token is invalid, which would
  // otherwise surface as an unhandled error and show a page not found.
  let user;
  try {
    const { data } = await client.auth.getUser();
    user = data.user;
  } catch (err) {
    const current_url = new URL(request.url).pathname;
    throw redirect(`/admin/login?next=${encodeURIComponent(current_url)}`);
  }

  if (!user || !user.email) {
    const current_url = new URL(request.url).pathname;
    throw redirect(`/admin/login?next=${encodeURIComponent(current_url)}`);
  }

  // ── Step 2: Check admin role ──────────────────────────────────────────────
  const { data: admin_row } = await client
    .from("admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (!admin_row) {
    // Authenticated but not an admin — redirect to login with error
    throw redirect("/admin/login?error=not_admin");
  }

  return { user, email: user.email };
}
