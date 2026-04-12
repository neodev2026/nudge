/**
 * POST /admin/api/users/:authUserId/update
 *
 * Unified admin action for user profile updates + turn grants.
 * Dispatches by action_type field in form data.
 *
 * action_type: "profile"   — update timezone / send_hour / is_active
 * action_type: "turns"     — grant turns (delegates to adminGrantTurns)
 */
import { data as routeData, redirect } from "react-router";
import type { Route } from "./+types/user-update";

import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import {
  adminUpdateUserProfile,
  adminGrantTurns,
} from "~/features/admin/lib/queries.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const form = await request.formData();
  const action_type = form.get("action_type") as string;
  const auth_user_id = params.authUserId;

  if (!auth_user_id) {
    return routeData({ error: "auth_user_id is required" }, { status: 400 });
  }

  // ── Profile update ────────────────────────────────────────────────────────
  if (action_type === "profile") {
    const timezone = form.get("timezone") as string | null;
    const send_hour_raw = form.get("send_hour") as string | null;
    const is_active_raw = form.get("is_active") as string | null;

    const updates: { timezone?: string; send_hour?: number; is_active?: boolean } = {};
    if (timezone) updates.timezone = timezone.trim();
    if (send_hour_raw !== null) {
      const h = parseInt(send_hour_raw, 10);
      if (h >= 0 && h <= 23) updates.send_hour = h;
    }
    if (is_active_raw !== null) updates.is_active = is_active_raw === "true";

    await adminUpdateUserProfile(client, auth_user_id, updates);
    return redirect(`/admin/users?selected=${auth_user_id}&saved=1`);
  }

  // ── Turn grant ────────────────────────────────────────────────────────────
  if (action_type === "turns") {
    const amount = parseInt(form.get("amount") as string, 10);
    const grant_type = form.get("grant_type") as "subscription" | "charged";

    if (!amount || amount <= 0 || amount > 10000) {
      return routeData({ error: "Invalid amount" }, { status: 400 });
    }

    await adminGrantTurns(client, auth_user_id, amount, grant_type);
    return redirect(`/admin/users?selected=${auth_user_id}&saved=1`);
  }

  return routeData({ error: "Unknown action_type" }, { status: 400 });
}
