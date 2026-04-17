/**
 * /admin/users
 *
 * Admin user management page.
 *
 * Layout:
 *   Left panel  — searchable user list
 *   Right panel — selected user detail: turn grant, timezone, send_hour settings
 *
 * URL state:
 *   ?q=<search>         — search query
 *   ?selected=<uid>     — selected auth_user_id
 *   ?saved=1            — show save success toast
 */
import type { Route } from "./+types/users";

import { useLoaderData, useFetcher, useSearchParams, Link, useNavigate } from "react-router";
import { useState, useEffect } from "react";

import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import {
  adminGetUsersWithTurnBalance,
  adminGetUserDetail,
} from "~/features/admin/lib/queries.server";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "사용자 관리 — Nudge Admin" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const selected_id = url.searchParams.get("selected") ?? null;
  const saved = url.searchParams.get("saved") === "1";

  // Use adminClient — auth.users requires service_role
  const all_users = await adminGetUsersWithTurnBalance(adminClient);

  // Client-side search is fine for small beta user counts
  const users = q
    ? all_users.filter(
        (u) =>
          (u.display_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
          (u.discord_id ?? "").toLowerCase().includes(q.toLowerCase())
      )
    : all_users;

  const selected_user = selected_id
    ? await adminGetUserDetail(adminClient, selected_id)
    : null;

  return { users, selected_id, selected_user, q, saved };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// IANA timezones — common set
const COMMON_TIMEZONES = [
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "UTC",
];

export default function AdminUsersPage() {
  const { users, selected_id, selected_user, q, saved } =
    useLoaderData<typeof loader>();
  const [search_params, set_search_params] = useSearchParams();
  const [toast, set_toast] = useState(saved);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => set_toast(false), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleSearch(value: string) {
    const next = new URLSearchParams(search_params);
    if (value) next.set("q", value);
    else next.delete("q");
    next.delete("selected");
    set_search_params(next);
  }

  function handleSelect(uid: string) {
    const next = new URLSearchParams(search_params);
    next.set("selected", uid);
    next.delete("saved");
    set_search_params(next);
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/admin"
          className="text-sm font-semibold text-[#6b7a99] hover:text-[#1a2744]"
        >
          ← 대시보드
        </Link>
        <div>
          <h1 className="font-display text-2xl font-black text-[#1a2744]">
            사용자 관리
          </h1>
          <p className="mt-0.5 text-sm text-[#6b7a99]">
            총 {users.length}명
          </p>
        </div>
      </div>

      {/* Save toast */}
      {toast && (
        <div className="mb-4 rounded-xl bg-[#4caf72]/10 border border-[#4caf72]/30 px-4 py-3 text-sm font-semibold text-[#4caf72]">
          ✅ 저장되었습니다.
        </div>
      )}

      <div className="flex gap-6">
        {/* ── Left: user list ── */}
        <div className="w-80 shrink-0 space-y-3">
          {/* Search */}
          <input
            type="text"
            defaultValue={q}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="이름 또는 SNS ID 검색…"
            className="w-full rounded-xl border border-[#e8ecf5] bg-white px-4 py-2.5 text-sm text-[#1a2744] placeholder:text-[#b0b8cc] focus:border-[#4caf72] focus:outline-none"
          />

          {/* User list */}
          <div className="overflow-hidden rounded-2xl border border-[#e8ecf5] bg-white">
            {users.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#6b7a99]">
                검색 결과가 없습니다.
              </p>
            ) : (
              users.map((u) => {
                const total = u.subscription_turns + u.charged_turns;
                const is_selected = u.auth_user_id === selected_id;
                return (
                  <button
                    key={u.auth_user_id}
                    onClick={() => handleSelect(u.auth_user_id)}
                    className={[
                      "flex w-full items-center gap-3 border-b border-[#e8ecf5] px-4 py-3 text-left transition last:border-0",
                      is_selected
                        ? "bg-[#1a2744] text-white"
                        : "hover:bg-[#f4f6fb]",
                    ].join(" ")}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={[
                        "truncate text-sm font-bold",
                        is_selected ? "text-white" : "text-[#1a2744]",
                      ].join(" ")}>
                        {u.display_name ?? u.email ?? u.auth_user_id.slice(0, 8)}
                      </p>
                      {u.email && (
                        <p className={[
                          "truncate text-xs",
                          is_selected ? "text-white/60" : "text-[#6b7a99]",
                        ].join(" ")}>
                          {u.email}
                        </p>
                      )}
                      <p className={[
                        "truncate text-xs",
                        is_selected ? "text-white/60" : "text-[#b0b8cc]",
                      ].join(" ")}>
                        {u.discord_id ? `Discord · ${u.discord_id}` : "Discord 미연결"}
                        {" · "}
                        {new Date(u.created_at).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <span className={[
                      "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold",
                      total > 0
                        ? is_selected
                          ? "bg-white/20 text-white"
                          : "bg-[#4caf72]/10 text-[#4caf72]"
                        : is_selected
                          ? "bg-white/20 text-white"
                          : "bg-red-50 text-red-500",
                    ].join(" ")}>
                      {total}턴
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right: user detail panel ── */}
        <div className="flex-1">
          {!selected_user ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-[#e8ecf5] text-sm text-[#b0b8cc]">
              왼쪽에서 사용자를 선택하세요
            </div>
          ) : (
            <UserDetailPanel key={selected_user.auth_user_id} user={selected_user} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// UserDetailPanel
// ---------------------------------------------------------------------------

function UserDetailPanel({
  user,
}: {
  user: NonNullable<Awaited<ReturnType<typeof adminGetUserDetail>>>;
}) {
  const profile_fetcher = useFetcher<{ error?: string }>();
  const turn_fetcher = useFetcher<{ error?: string }>();
  const total_turns = user.subscription_turns + user.charged_turns;
  const action_url = `/admin/api/users/${user.auth_user_id}/update`;

  return (
    <div className="space-y-5">
      {/* User header */}
      <div className="flex items-center gap-4 rounded-2xl bg-white border border-[#e8ecf5] px-5 py-4">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.display_name ?? ""}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a2744] text-lg font-black text-white">
            {(user.display_name ?? user.email ?? user.auth_user_id)[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-display text-lg font-black text-[#1a2744]">
            {user.display_name ?? user.email ?? user.auth_user_id.slice(0, 8)}
          </p>
          <p className="text-sm text-[#6b7a99]">
            {user.email && <span>{user.email}</span>}
            {user.discord_id && <span className="ml-2">Discord · {user.discord_id}</span>}
          </p>
          <p className="text-xs text-[#b0b8cc]">
            가입일: {new Date(user.auth_created_at).toLocaleDateString("ko-KR")}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className={[
            "font-display text-2xl font-black",
            total_turns > 0 ? "text-[#4caf72]" : "text-red-500",
          ].join(" ")}>
            {total_turns}턴
          </p>
          <p className="text-xs text-[#6b7a99]">잔여</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* ── Turn grant ── */}
        <div className="rounded-2xl bg-white border border-[#e8ecf5] px-5 py-5">
          <h3 className="mb-4 font-display text-sm font-black text-[#1a2744]">
            💬 턴 지급
          </h3>

          {/* Balance breakdown */}
          <div className="mb-4 space-y-1.5">
            <div className="flex justify-between text-xs text-[#6b7a99]">
              <span>월정기권</span>
              <span className="font-bold text-[#1a2744]">
                {user.subscription_turns}턴
              </span>
            </div>
            <div className="flex justify-between text-xs text-[#6b7a99]">
              <span>충전권</span>
              <span className="font-bold text-[#1a2744]">
                {user.charged_turns}턴
              </span>
            </div>
            {user.subscription_reset_at && (
              <div className="flex justify-between text-xs text-[#6b7a99]">
                <span>월정기권 리셋</span>
                <span>{new Date(user.subscription_reset_at).toLocaleDateString("ko-KR")}</span>
              </div>
            )}
          </div>

          <turn_fetcher.Form method="post" action={action_url} className="space-y-3">
            <input type="hidden" name="action_type" value="turns" />
            <div className="flex gap-2">
              <input
                type="number"
                name="amount"
                defaultValue={500}
                min={1}
                max={10000}
                className="w-24 rounded-xl border border-[#e8ecf5] px-3 py-2 text-sm text-[#1a2744] focus:border-[#4caf72] focus:outline-none"
              />
              <select
                name="grant_type"
                className="flex-1 rounded-xl border border-[#e8ecf5] px-3 py-2 text-sm text-[#1a2744] focus:border-[#4caf72] focus:outline-none"
              >
                <option value="charged">충전권 (누적)</option>
                <option value="subscription">월정기권 (리셋)</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={turn_fetcher.state !== "idle"}
              className="w-full rounded-xl bg-[#4caf72] py-2.5 text-sm font-extrabold text-white transition hover:bg-[#5ecb87] disabled:opacity-50"
            >
              {turn_fetcher.state !== "idle" ? "처리 중…" : "턴 지급"}
            </button>
          </turn_fetcher.Form>
        </div>

        {/* ── Profile settings ── */}
        <div className="rounded-2xl bg-white border border-[#e8ecf5] px-5 py-5">
          <h3 className="mb-4 font-display text-sm font-black text-[#1a2744]">
            ⚙️ 개인 설정
          </h3>

          <profile_fetcher.Form method="post" action={action_url} className="space-y-4">
            <input type="hidden" name="action_type" value="profile" />

            {/* Timezone */}
            <div>
              <label className="mb-1 block text-xs font-bold text-[#6b7a99]">
                타임존
              </label>
              <select
                name="timezone"
                defaultValue={user.timezone}
                className="w-full rounded-xl border border-[#e8ecf5] px-3 py-2 text-sm text-[#1a2744] focus:border-[#4caf72] focus:outline-none"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {/* Send hour */}
            <div>
              <label className="mb-1 block text-xs font-bold text-[#6b7a99]">
                DM 발송 시각 (0~23시)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="send_hour"
                  defaultValue={user.send_hour}
                  min={0}
                  max={23}
                  className="w-20 rounded-xl border border-[#e8ecf5] px-3 py-2 text-sm text-[#1a2744] focus:border-[#4caf72] focus:outline-none"
                />
                <span className="text-sm text-[#6b7a99]">시 (현지 기준)</span>
              </div>
            </div>

            {/* is_active */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                value="true"
                defaultChecked={user.is_active}
                className="h-4 w-4 rounded border-[#e8ecf5] text-[#4caf72]"
              />
              <label htmlFor="is_active" className="text-sm font-semibold text-[#1a2744]">
                활성 사용자
              </label>
            </div>

            <button
              type="submit"
              disabled={profile_fetcher.state !== "idle"}
              className="w-full rounded-xl bg-[#1a2744] py-2.5 text-sm font-extrabold text-white transition hover:bg-[#2a3a5c] disabled:opacity-50"
            >
              {profile_fetcher.state !== "idle" ? "저장 중…" : "설정 저장"}
            </button>
          </profile_fetcher.Form>
        </div>

        {/* ── Delete account ── */}
        <DeleteUserSection auth_user_id={user.auth_user_id} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeleteUserSection
// ---------------------------------------------------------------------------

function DeleteUserSection({ auth_user_id }: { auth_user_id: string }) {
  const [confirm, set_confirm] = useState(false);
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const navigate = useNavigate();
  const is_deleting = fetcher.state !== "idle";

  // On success, redirect to /admin/users (clear ?selected= param)
  useEffect(() => {
    if (fetcher.data?.ok) {
      navigate("/admin/users", { replace: true });
    }
  }, [fetcher.data]);

  return (
    <div className="rounded-2xl bg-white border border-red-100 px-5 py-5">
      <h3 className="mb-3 font-display text-sm font-black text-red-500">
        ⚠️ 회원 탈퇴
      </h3>
      {!confirm ? (
        <button
          onClick={() => set_confirm(true)}
          className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-50"
        >
          이 사용자 탈퇴 처리
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-red-500 font-bold text-center">
            정말 탈퇴 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => set_confirm(false)}
              className="flex-1 rounded-xl border border-[#e8ecf5] py-2.5 text-sm font-bold text-[#6b7a99]"
            >
              취소
            </button>
            <fetcher.Form
              method="post"
              action={`/admin/api/users/${auth_user_id}/delete`}
              className="flex-1"
            >
              <button
                type="submit"
                disabled={is_deleting}
                className="w-full rounded-xl bg-red-500 py-2.5 text-sm font-extrabold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {is_deleting ? "처리 중…" : "탈퇴 확인"}
              </button>
            </fetcher.Form>
          </div>
          {fetcher.data?.error && (
            <p className="text-xs text-red-500 text-center">{fetcher.data.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
