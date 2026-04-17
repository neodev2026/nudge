/**
 * /admin/site-settings
 *
 * Site settings page.
 * Contains maintenance mode toggle (moved from /admin dashboard).
 */
import type { Route } from "./+types/site-settings";
import { useLoaderData, useFetcher } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "사이트 설정 — Nudge Admin" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const { data: settings } = await adminClient
    .from("nv2_site_settings" as any)
    .select("maintenance_mode, maintenance_message, maintenance_until")
    .eq("id", 1)
    .maybeSingle();

  return {
    maintenance_mode:    (settings as any)?.maintenance_mode    ?? false,
    maintenance_message: (settings as any)?.maintenance_message ?? "서비스 점검 중입니다. 잠시 후 다시 이용해주세요.",
    maintenance_until:   (settings as any)?.maintenance_until   ?? null,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminSiteSettings() {
  const { maintenance_mode, maintenance_message, maintenance_until } =
    useLoaderData<typeof loader>();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-black text-[#1a2744]">
          사이트 설정
        </h1>
        <p className="mt-1 text-sm text-[#6b7a99]">
          서비스 운영 설정을 관리합니다
        </p>
      </div>

      {/* Maintenance mode */}
      <section>
        <h2 className="mb-4 font-display text-base font-black text-[#1a2744]">
          점검 모드
        </h2>
        <MaintenanceToggle
          maintenance_mode={maintenance_mode}
          maintenance_message={maintenance_message}
          maintenance_until={maintenance_until}
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MaintenanceToggle — extracted from old dashboard.tsx
// ---------------------------------------------------------------------------

function MaintenanceToggle({
  maintenance_mode,
  maintenance_message,
  maintenance_until,
}: {
  maintenance_mode: boolean;
  maintenance_message: string;
  maintenance_until: string | null;
}) {
  const fetcher = useFetcher<{ ok?: boolean; maintenance_mode?: boolean }>();
  const is_submitting = fetcher.state !== "idle";

  const current_mode =
    fetcher.data?.maintenance_mode !== undefined
      ? fetcher.data.maintenance_mode
      : maintenance_mode;

  function handleToggle() {
    fetcher.submit(
      JSON.stringify({
        maintenance_mode: !current_mode,
        maintenance_message,
        maintenance_until,
      }),
      {
        method: "POST",
        action: "/admin/api/maintenance/toggle",
        encType: "application/json",
      }
    );
  }

  return (
    <div className={[
      "rounded-2xl border p-5 transition-colors",
      current_mode ? "border-red-200 bg-red-50" : "border-[#e8ecf5] bg-white",
    ].join(" ")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{current_mode ? "🔧" : "✅"}</span>
          <div>
            <p className="font-display text-sm font-black text-[#1a2744]">
              점검 모드
            </p>
            <p className={[
              "mt-0.5 text-xs",
              current_mode ? "font-bold text-red-500" : "text-[#6b7a99]",
            ].join(" ")}>
              {current_mode
                ? "현재 점검 중 — 사용자에게 점검 화면 표시됨"
                : "정상 운영 중"}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={is_submitting}
          className={[
            "rounded-xl px-5 py-2.5 text-sm font-extrabold transition-all disabled:opacity-50",
            current_mode
              ? "bg-[#4caf72] text-white hover:bg-[#5ecb87]"
              : "bg-red-500 text-white hover:bg-red-600",
          ].join(" ")}
        >
          {is_submitting
            ? "처리 중..."
            : current_mode
            ? "✅ 점검 해제"
            : "🔧 점검 모드 ON"}
        </button>
      </div>
    </div>
  );
}
