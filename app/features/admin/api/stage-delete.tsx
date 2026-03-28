/**
 * POST /admin/api/stages/:id/delete
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/stage-delete";

import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import { adminDeleteStage } from "~/features/admin/lib/queries.server";

export async function action({ request, params }: Route.ActionArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);
  await adminDeleteStage(client, params.id);
  return routeData({ ok: true });
}
