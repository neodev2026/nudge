/**
 * Admin Stage API
 *
 * POST /admin/api/stages/upsert  — create or update a stage
 * POST /admin/api/stages/:id/delete — delete a stage
 */
import { redirect } from "react-router";
import { data as routeData } from "react-router";
import type { Route } from "./+types/stages";

import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import {
  adminUpsertStage,
  adminDeleteStage,
} from "~/features/admin/lib/queries.server";

// POST /admin/api/stages/upsert
export async function action({ request }: Route.ActionArgs) {
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
