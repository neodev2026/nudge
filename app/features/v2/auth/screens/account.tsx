/**
 * GET /account
 *
 * User account settings page.
 * Shows profile info and provides account deletion.
 * Requires authentication.
 */
import type { Route } from "./+types/account";
import { useLoaderData, useFetcher } from "react-router";
import { redirect, Link } from "react-router";
import { useState } from "react";
import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";

export const meta: Route.MetaFunction = () => [
  { title: "계정 설정 — Nudge" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    throw redirect(`/login?next=${encodeURIComponent("/account")}`);
  }

  const { data: profile } = await adminClient
    .from("nv2_profiles")
    .select("display_name, avatar_url, email, discord_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  // Determine login method from user identities
  const identities = user.identities ?? [];
  const login_methods = identities.map((i) => i.provider);

  return {
    display_name: profile?.display_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    email: profile?.email ?? user.email ?? null,
    discord_id: (profile as any)?.discord_id ?? null,
    login_methods,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AccountPage() {
  const { display_name, avatar_url, email, discord_id, login_methods } =
    useLoaderData<typeof loader>();

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      {/* Back */}
      <div className="mb-6">
        <Link
          to="/products"
          className="text-sm font-semibold text-[#6b7a99] hover:text-[#1a2744]"
        >
          ← 학습 상품
        </Link>
      </div>

      <h1 className="mb-8 font-display text-2xl font-black text-[#1a2744]">
        계정 설정
      </h1>

      {/* Profile card */}
      <div className="mb-4 rounded-2xl border border-[#e8ecf5] bg-white px-6 py-5">
        <h2 className="mb-4 text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
          프로필
        </h2>
        <div className="flex items-center gap-4">
          {avatar_url ? (
            <img
              src={avatar_url}
              alt={display_name ?? ""}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a2744] text-lg font-black text-white">
              {(display_name ?? email ?? "?")[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-bold text-[#1a2744]">
              {display_name ?? "이름 없음"}
            </p>
            <p className="text-sm text-[#6b7a99]">{email ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Login methods */}
      <div className="mb-4 rounded-2xl border border-[#e8ecf5] bg-white px-6 py-5">
        <h2 className="mb-4 text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
          연결된 계정
        </h2>
        <div className="space-y-2">
          {login_methods.includes("google") && (
            <div className="flex items-center gap-3 rounded-xl bg-[#f4f6fb] px-4 py-3">
              <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-sm font-semibold text-[#1a2744]">Google</span>
            </div>
          )}
          {(login_methods.includes("discord") || discord_id) && (
            <div className="flex items-center gap-3 rounded-xl bg-[#f4f6fb] px-4 py-3">
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="#5865F2">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
              </svg>
              <span className="text-sm font-semibold text-[#1a2744]">Discord</span>
            </div>
          )}
          {login_methods.includes("email") && (
            <div className="flex items-center gap-3 rounded-xl bg-[#f4f6fb] px-4 py-3">
              <svg className="size-4 shrink-0 text-[#6b7a99]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span className="text-sm font-semibold text-[#1a2744]">이메일</span>
            </div>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-100 bg-white px-6 py-5">
        <h2 className="mb-1 text-xs font-extrabold uppercase tracking-wider text-red-400">
          위험 구역
        </h2>
        <p className="mb-4 text-xs text-[#6b7a99]">
          탈퇴 시 모든 학습 데이터가 영구 삭제됩니다.
        </p>
        <DeleteAccountButton />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeleteAccountButton
// ---------------------------------------------------------------------------

function DeleteAccountButton() {
  const [step, set_step] = useState<"idle" | "confirm">("idle");
  const fetcher = useFetcher<{ error?: string }>();
  const is_deleting = fetcher.state !== "idle";

  if (step === "idle") {
    return (
      <button
        onClick={() => set_step("confirm")}
        className="w-full rounded-xl border border-red-200 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-50"
      >
        회원 탈퇴
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-red-50 px-4 py-3 text-center">
        <p className="text-sm font-bold text-red-600">
          정말 탈퇴하시겠습니까?
        </p>
        <p className="mt-1 text-xs text-red-400">
          모든 학습 데이터가 즉시 삭제되며 복구할 수 없습니다.
        </p>
      </div>

      {fetcher.data?.error && (
        <p className="text-xs font-bold text-red-500 text-center">
          {fetcher.data.error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => set_step("idle")}
          disabled={is_deleting}
          className="flex-1 rounded-xl border border-[#e8ecf5] py-2.5 text-sm font-bold text-[#6b7a99] transition hover:bg-[#f4f6fb] disabled:opacity-50"
        >
          취소
        </button>
        <fetcher.Form
          method="post"
          action="/api/v2/auth/delete-account"
          className="flex-1"
        >
          <button
            type="submit"
            disabled={is_deleting}
            className="w-full rounded-xl bg-red-500 py-2.5 text-sm font-extrabold text-white transition hover:bg-red-600 disabled:opacity-50"
          >
            {is_deleting ? "처리 중..." : "탈퇴 확인"}
          </button>
        </fetcher.Form>
      </div>
    </div>
  );
}
