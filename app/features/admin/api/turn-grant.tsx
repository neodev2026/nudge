/**
 * POST /admin/api/turns/grant
 *
 * Grants AI chat turns to a user.
 * Admin only — requires admin session.
 *
 * Request body (form):
 *   auth_user_id : string
 *   amount       : number
 *   grant_type   : "subscription" | "charged"
 */
import { data as routeData, redirect } from "react-router";
import type { Route } from "./+types/turn-grant";

import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import { adminGrantTurns } from "~/features/admin/lib/queries.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const form = await request.formData();
  const auth_user_id = form.get("auth_user_id") as string;
  const amount = parseInt(form.get("amount") as string, 10);
  const grant_type = form.get("grant_type") as "subscription" | "charged";

  if (!auth_user_id || !amount || !grant_type) {
    return routeData({ error: "Missing required fields" }, { status: 400 });
  }

  if (amount <= 0 || amount > 10000) {
    return routeData({ error: "Amount must be between 1 and 10000" }, { status: 400 });
  }

  await adminGrantTurns(client, auth_user_id, amount, grant_type);

  return redirect("/admin");
}
