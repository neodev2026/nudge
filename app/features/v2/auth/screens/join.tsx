/**
 * GET/POST /join
 *
 * v2 signup page — email+password + Google OAuth + Discord OAuth.
 * On success shows email verification notice.
 */
import type { Route } from "./+types/join";

import { Form, Link, data, useLoaderData } from "react-router";
import { z } from "zod";
import { useState } from "react";
import makeServerClient from "~/core/lib/supa-client.server";

export const meta: Route.MetaFunction = () => [
  { title: "회원가입 — Nudge" },
];

const joinSchema = z
  .object({
    name: z.string().min(1, { message: "이름을 입력해주세요" }),
    email: z.string().email({ message: "올바른 이메일 주소를 입력해주세요" }),
    password: z.string().min(8, { message: "비밀번호는 8자 이상이어야 합니다" }),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirm_password"],
  });

// ---------------------------------------------------------------------------
// Loader — reads ?next= server-side to avoid SSR/hydration mismatch
// ---------------------------------------------------------------------------

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/products";
  return { next };
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const { data: valid, success, error } = joinSchema.safeParse(
    Object.fromEntries(formData)
  );

  if (!success) {
    return data(
      { fieldErrors: error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const [client] = makeServerClient(request);
  const { error: signUpError } = await client.auth.signUp({
    email: valid.email,
    password: valid.password,
    options: {
      data: {
        name: valid.name,
        display_name: valid.name,
      },
    },
  });

  if (signUpError) {
    return data({ error: signUpError.message }, { status: 400 });
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function JoinPage({ actionData }: Route.ComponentProps) {
  const { next } = useLoaderData<typeof loader>();

  const field_errors =
    actionData && "fieldErrors" in actionData ? actionData.fieldErrors : null;
  const form_error =
    actionData && "error" in actionData ? actionData.error : null;
  const is_success =
    actionData && "success" in actionData && actionData.success;

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-black text-[#1a2744]">
            시작해볼까요 🚀
          </h1>
          <p className="mt-2 text-sm text-[#6b7a99]">
            계정을 만들고 학습을 시작하세요
          </p>
        </div>

        {is_success ? (
          // Success state
          <div className="rounded-2xl bg-[#4caf72]/10 border border-[#4caf72]/30 px-6 py-8 text-center">
            <div className="mb-3 text-3xl">📬</div>
            <p className="font-display text-lg font-black text-[#1a2744]">
              이메일을 확인해주세요
            </p>
            <p className="mt-2 text-sm text-[#6b7a99]">
              입력하신 이메일로 안내 메일을 발송했습니다.
              <br />
              메일함을 확인해주세요.
              <br />
              <span className="mt-2 inline-block text-xs text-[#b0b8cc]">
                이미 가입된 이메일이라면 다른 안내 메일이 발송됩니다.
              </span>
            </p>
            <Link
              to={`/login?next=${encodeURIComponent(next)}`}
              className="mt-6 inline-block rounded-2xl bg-[#1a2744] px-6 py-3 text-sm font-extrabold text-white"
            >
              로그인하기
            </Link>
          </div>
        ) : (
          <>
            {/* Social login buttons */}
            <div className="mb-6 space-y-3">
              <a
                href={`/auth/google/start?next=${encodeURIComponent(next)}`}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#e8ecf5] bg-white px-4 py-3 text-sm font-bold text-[#1a2744] transition-all hover:border-[#d0d7e8] hover:shadow-sm"
              >
                <svg className="size-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google로 회원가입
              </a>

              <a
                href={`/auth/discord/start?next=${encodeURIComponent(next)}`}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#5865F2] px-4 py-3 text-sm font-bold text-white transition-all hover:bg-[#4752C4] hover:shadow-sm"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                </svg>
                Discord로 회원가입
              </a>
            </div>

            {/* Divider */}
            <div className="mb-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-[#e8ecf5]" />
              <span className="text-xs text-[#6b7a99]">또는</span>
              <span className="h-px flex-1 bg-[#e8ecf5]" />
            </div>

            {/* Email form */}
            <Form method="post" className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-xs font-bold text-[#6b7a99]">
                  이름
                </label>
                <input
                  id="name" name="name" type="text" required
                  placeholder="홍길동"
                  className="w-full rounded-xl border border-[#e8ecf5] bg-white px-4 py-3 text-sm text-[#1a2744] placeholder:text-[#b0b8cc] focus:border-[#4caf72] focus:outline-none"
                />
                {field_errors?.name && (
                  <p className="mt-1 text-xs text-red-500">{field_errors.name[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-[#6b7a99]">
                  이메일
                </label>
                <input
                  id="email" name="email" type="email" required
                  placeholder="hello@example.com"
                  className="w-full rounded-xl border border-[#e8ecf5] bg-white px-4 py-3 text-sm text-[#1a2744] placeholder:text-[#b0b8cc] focus:border-[#4caf72] focus:outline-none"
                />
                {field_errors?.email && (
                  <p className="mt-1 text-xs text-red-500">{field_errors.email[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-bold text-[#6b7a99]">
                  비밀번호
                </label>
                <input
                  id="password" name="password" type="password" required
                  placeholder="8자 이상"
                  className="w-full rounded-xl border border-[#e8ecf5] bg-white px-4 py-3 text-sm text-[#1a2744] placeholder:text-[#b0b8cc] focus:border-[#4caf72] focus:outline-none"
                />
                {field_errors?.password && (
                  <p className="mt-1 text-xs text-red-500">{field_errors.password[0]}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirm_password" className="mb-1.5 block text-xs font-bold text-[#6b7a99]">
                  비밀번호 확인
                </label>
                <input
                  id="confirm_password" name="confirm_password" type="password" required
                  placeholder="비밀번호 재입력"
                  className="w-full rounded-xl border border-[#e8ecf5] bg-white px-4 py-3 text-sm text-[#1a2744] placeholder:text-[#b0b8cc] focus:border-[#4caf72] focus:outline-none"
                />
                {field_errors?.confirm_password && (
                  <p className="mt-1 text-xs text-red-500">{field_errors.confirm_password[0]}</p>
                )}
              </div>

              <p className="text-xs text-[#6b7a99]">
                회원가입 시{" "}
                <Link to="/legal/terms-of-service" className="underline hover:text-[#1a2744]">
                  이용약관
                </Link>
                {" "}및{" "}
                <Link to="/legal/privacy-policy" className="underline hover:text-[#1a2744]">
                  개인정보처리방침
                </Link>
                에 동의하는 것으로 간주합니다.
              </p>

              {form_error && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600">
                  {form_error}
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-2xl bg-[#1a2744] py-3.5 text-sm font-extrabold text-white transition-all hover:bg-[#243358]"
              >
                회원가입
              </button>
            </Form>

            <p className="mt-6 text-center text-sm text-[#6b7a99]">
              이미 계정이 있으신가요?{" "}
              <Link
                to={`/login?next=${encodeURIComponent(next)}`}
                className="font-bold text-[#4caf72] hover:underline"
              >
                로그인
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
