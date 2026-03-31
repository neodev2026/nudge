/**
 * POST /admin/api/cards/:id/delete
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/card-delete";

export async function action({ request, params }: Route.ActionArgs) {
  const { default: makeServerClient } = await import("~/core/lib/supa-client.server");
  const { requireAdmin } = await import("~/features/admin/lib/guards.server");
  const { adminDeleteCard } = await import("~/features/admin/lib/queries.server");

  const [client] = makeServerClient(request);
  await requireAdmin(client, request);
  await adminDeleteCard(client, params.id);
  return routeData({ ok: true });
}
