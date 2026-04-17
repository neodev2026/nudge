/**
 * Admin Layout
 *
 * Wraps all /admin/* routes (except /admin/login).
 * - Verifies admin authentication on every request
 * - Renders a persistent sidebar with navigation
 */
import type { Route } from "./+types/admin.layout";

import { Link, Outlet, useLocation, Form } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import { requireAdmin } from "~/features/admin/lib/guards.server";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  const { email } = await requireAdmin(client, request);
  return { email };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { email } = loaderData;
  const location = useLocation();

  const nav_items = [
    { href: "/admin", label: "상품 목록", icon: "📦" },
    { href: "/admin/users", label: "사용자 관리", icon: "👥" },
    { href: "/admin/trial-sessions", label: "체험 세션", icon: "✨" },
  ];

  return (
    <div className="flex min-h-screen bg-[#f4f6fb]">
      {/* ── Sidebar ── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-[#e8ecf5] bg-white">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-[#e8ecf5] px-5">
          <Link to="/admin" className="font-display text-xl font-black text-[#1a2744]">
            Nudge<span className="text-[#4caf72]">.</span>
            <span className="ml-1.5 rounded bg-[#1a2744] px-1.5 py-0.5 text-[0.6rem] font-black uppercase tracking-wide text-white">
              admin
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 p-3">
          {nav_items.map(({ href, label, icon }) => {
            const is_active =
              href === "/admin"
                ? location.pathname === "/admin"
                : location.pathname.startsWith(href);
            return (
              <Link
                key={href}
                to={href}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  is_active
                    ? "bg-[#1a2744] text-white"
                    : "text-[#6b7a99] hover:bg-[#f4f6fb] hover:text-[#1a2744]",
                ].join(" ")}
              >
                <span>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer — user info + logout */}
        <div className="border-t border-[#e8ecf5] p-4">
          <p className="mb-2 truncate text-xs text-[#6b7a99]">{email}</p>
          <Form method="post" action="/admin/logout">
            <button
              type="submit"
              className="w-full rounded-lg bg-[#f4f6fb] px-3 py-2 text-xs font-bold text-[#6b7a99] transition-colors hover:bg-[#e8ecf5] hover:text-[#1a2744]"
            >
              로그아웃
            </button>
          </Form>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
