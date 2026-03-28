/**
 * POST /admin/api/cards/:id/delete
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/card-delete";

import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import { adminDeleteCard } from "~/features/admin/lib/queries.server";

export async function action({ request, params }: Route.ActionArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);
  await adminDeleteCard(client, params.id);
  return routeData({ ok: true });
}
