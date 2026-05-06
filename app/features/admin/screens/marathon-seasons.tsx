/**
 * /admin/marathon-seasons
 *
 * Admin page for managing marathon ranking seasons.
 * Lists all seasons with status badges and provides a creation form.
 */
import type { Route } from "./+types/marathon-seasons";
import { useLoaderData, useFetcher } from "react-router";
import { useState } from "react";
import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";

export const meta: Route.MetaFunction = () => [
  { title: "마라톤 시즌 관리 — Nudge Admin" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const { data, error } = await adminClient
    .from("nv2_marathon_seasons")
    .select("id, title, starts_at, ends_at, timezone, created_at")
    .order("starts_at", { ascending: false });

  if (error) throw new Error(error.message);

  const now = new Date();
  const seasons = (data ?? []).map((s) => {
    const start = new Date(String(s.starts_at));
    const end = new Date(String(s.ends_at));
    const is_active = start <= now && now <= end;
    const is_upcoming = start > now;
    return { ...s, is_active, is_upcoming };
  });

  return { seasons };
}

// ---------------------------------------------------------------------------
// Action — create season
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent !== "create") {
    return Response.json({ error: "Unknown intent" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const starts_at = String(form.get("starts_at") ?? "").trim();
  const ends_at = String(form.get("ends_at") ?? "").trim();
  const timezone = String(form.get("timezone") ?? "").trim();

  if (!title || !starts_at || !ends_at || !timezone) {
    return Response.json({ error: "모든 필드를 입력해주세요." }, { status: 400 });
  }

  if (new Date(starts_at).getTime() >= new Date(ends_at).getTime()) {
    return Response.json(
      { error: "시작 시간은 종료 시간보다 앞서야 합니다." },
      { status: 400 }
    );
  }

  const { error } = await adminClient.from("nv2_marathon_seasons").insert({
    title,
    starts_at: new Date(starts_at).toISOString(),
    ends_at: new Date(ends_at).toISOString(),
    timezone,
  });

  if (error) throw new Error(error.message);

  return Response.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Timezone options
// ---------------------------------------------------------------------------

const TIMEZONE_OPTIONS = [
  { label: "UTC",               value: "UTC" },
  { label: "Asia/Seoul",        value: "Asia/Seoul" },
  { label: "Europe/Berlin",     value: "Europe/Berlin" },
  { label: "America/New_York",  value: "America/New_York" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MarathonSeasonsPage() {
  const { seasons } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [timezone, setTimezone] = useState("Asia/Seoul");
  const [clientError, setClientError] = useState<string | null>(null);

  const actionData = fetcher.data as { error?: string; ok?: boolean } | undefined;
  const serverError = actionData?.error ?? null;

  // Reset form on successful submit
  const isSuccess = !!actionData?.ok;
  if (isSuccess && title !== "") {
    setTitle("");
    setStartsAt("");
    setEndsAt("");
    setTimezone("Asia/Seoul");
    setClientError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);

    if (!title.trim() || !startsAt || !endsAt || !timezone) {
      setClientError("모든 필드를 입력해주세요.");
      return;
    }
    if (new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
      setClientError("시작 시간은 종료 시간보다 앞서야 합니다.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    fetcher.submit(fd, { method: "post" });
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-[#1a2744]">마라톤 시즌 관리</h1>

      {/* ── Create form ── */}
      <section className="rounded-2xl border border-[#e8ecf5] bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-[#1a2744]">새 시즌 생성</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="intent" value="create" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-[#6b7a99]">
                시즌명
              </label>
              <input
                name="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 2026년 봄 시즌"
                className="w-full rounded-xl border border-[#e8ecf5] px-3 py-2 text-sm text-[#1a2744] focus:border-[#1a2744] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#6b7a99]">
                시작 (datetime-local)
              </label>
              <input
                name="starts_at"
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-xl border border-[#e8ecf5] px-3 py-2 text-sm text-[#1a2744] focus:border-[#1a2744] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#6b7a99]">
                종료 (datetime-local)
              </label>
              <input
                name="ends_at"
                type="datetime-local"
                required
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-xl border border-[#e8ecf5] px-3 py-2 text-sm text-[#1a2744] focus:border-[#1a2744] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[#6b7a99]">
                Timezone
              </label>
              <select
                name="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-[#e8ecf5] px-3 py-2 text-sm text-[#1a2744] focus:border-[#1a2744] focus:outline-none"
              >
                {TIMEZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(clientError || serverError) && (
            <p className="text-sm text-red-600">{clientError ?? serverError}</p>
          )}

          <button
            type="submit"
            disabled={fetcher.state !== "idle"}
            className="rounded-xl bg-[#1a2744] px-5 py-2 text-sm font-semibold text-white hover:bg-[#243560] disabled:opacity-50"
          >
            {fetcher.state !== "idle" ? "저장 중…" : "시즌 생성"}
          </button>
        </form>
      </section>

      {/* ── Season list ── */}
      <section className="rounded-2xl border border-[#e8ecf5] bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f4f6fb]">
            <tr>
              {["시즌명", "시작", "종료", "Timezone", "상태"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-semibold text-[#6b7a99]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f4f6fb]">
            {seasons.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[#6b7a99]"
                >
                  등록된 시즌이 없습니다.
                </td>
              </tr>
            ) : (
              seasons.map((s) => (
                <tr key={s.id} className="hover:bg-[#f9fafc]">
                  <td className="px-4 py-3 font-medium text-[#1a2744]">
                    {s.title}
                  </td>
                  <td className="px-4 py-3 text-[#6b7a99]">
                    {formatDatetime(String(s.starts_at))}
                  </td>
                  <td className="px-4 py-3 text-[#6b7a99]">
                    {formatDatetime(String(s.ends_at))}
                  </td>
                  <td className="px-4 py-3 text-[#6b7a99]">{s.timezone}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      is_active={s.is_active}
                      is_upcoming={s.is_upcoming}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDatetime(iso: string) {
  return new Date(iso).toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({
  is_active,
  is_upcoming,
}: {
  is_active: boolean;
  is_upcoming: boolean;
}) {
  if (is_active) {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
        진행 중
      </span>
    );
  }
  if (is_upcoming) {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
        예정
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      종료
    </span>
  );
}
