/**
 * Admin Stage API
 *
 * POST /admin/api/stages/upsert — create or update a stage
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/stages";

export async function action({ request }: Route.ActionArgs) {
  const { default: makeServerClient } = await import("~/core/lib/supa-client.server");
  const { requireAdmin } = await import("~/features/admin/lib/guards.server");
  const { adminUpsertStage } = await import("~/features/admin/lib/queries.server");

  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const form_data = await request.formData();
  const id = form_data.get("id") as string | null;
  const learning_product_id = form_data.get("learning_product_id") as string;
  const title = form_data.get("title") as string;
  const stage_number = Number(form_data.get("stage_number"));
  const stage_type = form_data.get("stage_type") as string;
  const is_active = form_data.get("is_active") === "true";

  if (!learning_product_id || !title || !stage_type) {
    return routeData({ error: "필수 항목이 누락됐습니다." }, { status: 400 });
  }

  await adminUpsertStage(client, {
    ...(id ? { id } : {}),
    learning_product_id,
    title,
    stage_number,
    stage_type,
    is_active,
  });

  return routeData({ ok: true });
}
