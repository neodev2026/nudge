/**
 * POST /admin/api/maintenance/toggle
 *
 * Toggles maintenance mode on/off.
 * Reads/writes the maintenance_mode flag in nv2_site_settings.
 * Admin authentication required.
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/maintenance";

import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const body = await request.json().catch(() => ({}));
  const { maintenance_mode, maintenance_message, maintenance_until } = body as {
    maintenance_mode: boolean;
    maintenance_message?: string;
    maintenance_until?: string | null;
  };

  // Upsert into nv2_site_settings (single-row settings table)
  const { error } = await adminClient
    .from("nv2_site_settings" as any)
    .upsert({
      id: 1, // single row
      maintenance_mode: !!maintenance_mode,
      maintenance_message: maintenance_message ?? "서비스 점검 중입니다. 잠시 후 다시 이용해주세요.",
      maintenance_until: maintenance_until ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

  if (error) {
    console.error("[maintenance/toggle] upsert failed:", error);
    return routeData({ error: error.message }, { status: 500 });
  }

  return routeData({ ok: true, maintenance_mode: !!maintenance_mode });
}
