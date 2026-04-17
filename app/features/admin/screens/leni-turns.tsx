/**
 * /admin/leni-turns
 *
 * Leni AI chat turn management page.
 * Moved from /admin (dashboard).
 */
import type { Route } from "./+types/leni-turns";
import { useLoaderData, useFetcher } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";
import { adminGetUsersWithTurnBalance } from "~/features/admin/lib/queries.server";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "Leni 채팅 턴 관리 — Nudge Admin" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  await requireAdmin(client, request);
  const users = await adminGetUsersWithTurnBalance(adminClient);
  return { users };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminLeniTurns() {
  const { users } = useLoaderData<typeof loader>();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-black text-[#1a2744]">
          Leni 채팅 턴 관리
        </h1>
        <p className="mt-1 text-sm text-[#6b7a99]">
          사용자별 AI 채팅 턴 잔여량을 확인하고 지급합니다
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e8ecf5] bg-white">
        <table className="w-full">
          <thead className="border-b border-[#e8ecf5] bg-[#f4f6fb]">
            <tr>
              {["사용자", "월정기권", "충전권", "합계", "지급"].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e8ecf5]">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-[#b0b8cc]">
                  사용자가 없습니다
                </td>
              </tr>
            ) : (
              users.map((u) => <TurnRow key={u.auth_user_id} user={u} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TurnRow
// ---------------------------------------------------------------------------

function TurnRow({ user }: {
  user: {
    auth_user_id: string;
    email: string | null;
    display_name: string | null;
    discord_id: string | null;
    subscription_turns: number;
    charged_turns: number;
  };
}) {
  const fetcher = useFetcher();
  const total = user.subscription_turns + user.charged_turns;

  return (
    <tr className="transition-colors hover:bg-[#f4f6fb]">
      <td className="px-5 py-4">
        <p className="font-semibold text-[#1a2744]">
          {user.display_name ?? user.auth_user_id.slice(0, 8)}
        </p>
        <p className="text-xs text-[#6b7a99]">
          {user.discord_id ? `Discord · ${user.discord_id}` : user.email ?? "—"}
        </p>
      </td>
      <td className="px-5 py-4 text-sm text-[#1a2744]">
        {user.subscription_turns.toLocaleString()}턴
      </td>
      <td className="px-5 py-4 text-sm text-[#1a2744]">
        {user.charged_turns.toLocaleString()}턴
      </td>
      <td className="px-5 py-4">
        <span className={[
          "rounded-full px-2.5 py-1 text-xs font-bold",
          total > 0 ? "bg-[#4caf72]/10 text-[#4caf72]" : "bg-red-50 text-red-500",
        ].join(" ")}>
          {total.toLocaleString()}턴
        </span>
      </td>
      <td className="px-5 py-4">
        <fetcher.Form method="post" action="/admin/api/turns/grant" className="flex items-center gap-2">
          <input type="hidden" name="auth_user_id" value={user.auth_user_id} />
          <input
            type="number"
            name="amount"
            defaultValue={500}
            min={1}
            max={10000}
            className="w-20 rounded-lg border border-[#e8ecf5] px-2 py-1 text-xs text-[#1a2744] focus:border-[#4caf72] focus:outline-none"
          />
          <select
            name="grant_type"
            className="rounded-lg border border-[#e8ecf5] px-2 py-1 text-xs text-[#1a2744] focus:border-[#4caf72] focus:outline-none"
          >
            <option value="charged">충전권</option>
            <option value="subscription">월정기권</option>
          </select>
          <button
            type="submit"
            disabled={fetcher.state !== "idle"}
            className="rounded-lg bg-[#1a2744] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#2a3a5c] disabled:opacity-50"
          >
            {fetcher.state !== "idle" ? "처리 중..." : "지급"}
          </button>
        </fetcher.Form>
      </td>
    </tr>
  );
}
