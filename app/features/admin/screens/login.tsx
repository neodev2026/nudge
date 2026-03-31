/**
 * /admin/login
 *
 * Admin-only login page using email/password.
 * On success, checks admin role and redirects to /admin (or ?next= param).
 */
import type { Route } from "./+types/login";

import { Form, redirect, useSearchParams } from "react-router";
import { data as routeData } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "어드민 로그인 — Nudge" },
];

// ---------------------------------------------------------------------------
// Loader — redirect if already logged in as admin
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();

  if (user?.email) {
    const { data: admin_row } = await client
      .from("admins")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();

    if (admin_row) {
      const next = new URL(request.url).searchParams.get("next") ?? "/admin";
      throw redirect(next);
    }
  }

  return {};
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
  const form_data = await request.formData();
  const email = form_data.get("email") as string;
  const password = form_data.get("password") as string;
  const next = (form_data.get("next") as string) || "/admin";

  if (!email || !password) {
    return routeData(
      { error: "이메일과 비밀번호를 입력해주세요." },
      { status: 400 }
    );
  }

  const [client, headers] = makeServerClient(request);

  // ── Sign in ───────────────────────────────────────────────────────────────
  const { error: sign_in_error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (sign_in_error) {
    return routeData(
      { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  // ── Check admin role ──────────────────────────────────────────────────────
  const { data: admin_row } = await client
    .from("admins")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (!admin_row) {
    await client.auth.signOut();
    return routeData(
      { error: "관리자 권한이 없습니다." },
      { status: 403 }
    );
  }

  return redirect(next, { headers });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminLoginPage({
  actionData,
}: Route.ComponentProps) {
  const [search_params] = useSearchParams();
  const next = search_params.get("next") ?? "/admin";
  const error_param = search_params.get("error");

  const error_message =
    actionData && "error" in actionData
      ? actionData.error
      : error_param === "not_admin"
      ? "관리자 권한이 없습니다."
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fdf8f0] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <span className="font-display text-3xl font-black text-[#1a2744]">
            Nudge<span className="text-[#4caf72]">.</span>
          </span>
          <p className="mt-1 text-sm text-[#6b7a99]">어드민 로그인</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-white p-8 shadow-[0_8px_40px_rgba(26,39,68,0.10)]">
          <Form method="post" className="space-y-5">
            <input type="hidden" name="next" value={next} />

            {/* Email */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="text-sm font-bold text-[#1a2744]"
              >
                이메일
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="admin@example.com"
                className="w-full rounded-xl border border-[#e8ecf5] bg-[#fdf8f0] px-4 py-3 text-sm text-[#1a2744] outline-none transition-colors focus:border-[#1a2744] focus:bg-white"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="text-sm font-bold text-[#1a2744]"
              >
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#e8ecf5] bg-[#fdf8f0] px-4 py-3 text-sm text-[#1a2744] outline-none transition-colors focus:border-[#1a2744] focus:bg-white"
              />
            </div>

            {/* Error */}
            {error_message && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {error_message}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="w-full rounded-xl bg-[#1a2744] py-3 text-sm font-extrabold text-white transition-all hover:bg-[#243358] active:scale-[0.98]"
            >
              로그인
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
