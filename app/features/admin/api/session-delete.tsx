/**
 * POST /admin/api/sessions/:id/delete
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/session-delete";

import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import { adminDeleteProductSession } from "~/features/admin/lib/queries.server";

export async function action({ request, params }: Route.ActionArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);
  await adminDeleteProductSession(client, params.id);
  return routeData({ ok: true });
}
