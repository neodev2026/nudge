/**
 * GET /auth/google/callback
 *
 * Handles Google OAuth callback from Supabase.
 * Flow:
 *   1. exchangeCodeForSession(code)
 *   2. Check if this is a new user (pre-upsert)
 *   3. Upsert nv2_profiles (auth_user_id, email, display_name, avatar_url)
 *      — discord_id is NOT set for Google users
 *   4. If new user → send welcome email via Resend (fire-and-forget)
 *   5. Redirect to ?next= (default: /products)
 */
import type { Route } from "./+types/google-callback";
import { data, redirect } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/products";
  const error_param = url.searchParams.get("error");

  if (error_param) {
    const desc = url.searchParams.get("error_description") ?? "인증 실패";
    return data({ error: desc }, { status: 400 });
  }

  if (!code) {
    return data({ error: "인증 코드가 없습니다" }, { status: 400 });
  }

  const [client, headers] = makeServerClient(request);

  // Exchange code for session
  const { data: session_data, error: session_error } =
    await client.auth.exchangeCodeForSession(code);

  if (session_error || !session_data.user) {
    return data(
      { error: session_error?.message ?? "세션 생성 실패" },
      { status: 400 }
    );
  }

  const auth_user = session_data.user;
  const meta = auth_user.user_metadata as Record<string, unknown>;

  const display_name =
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    null;
  const avatar_url =
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null;
  const email = auth_user.email ?? null;

  // Check if this is a new user before upsert
  const { data: existing_profile } = await adminClient
    .from("nv2_profiles")
    .select("auth_user_id")
    .eq("auth_user_id", auth_user.id)
    .maybeSingle();

  const is_new_user = existing_profile === null;

  // Upsert nv2_profiles — Google users have no discord_id
  await adminClient
    .from("nv2_profiles")
    .upsert(
      {
        auth_user_id: auth_user.id,
        email,
        display_name,
        avatar_url,
        // discord_id intentionally omitted — Google login does not provide one
      },
      {
        onConflict: "auth_user_id",
        ignoreDuplicates: false,
      }
    )
    .then(({ error }) => {
      if (error) console.error("[google-callback] upsertNv2Profile failed:", error);
    });

  // Send welcome email to new users (fire-and-forget)
  if (is_new_user && email) {
    const origin = new URL(request.url).origin;
    const products_url = `${origin}/products`;

    const { sendWelcomeEmail } = await import(
      "~/features/v2/auth/lib/email.server"
    );
    sendWelcomeEmail(email, display_name, products_url).catch((err) => {
      console.error("[google-callback] sendWelcomeEmail failed:", err);
    });
  }

  return redirect(next, { headers });
}

export default function GoogleCallback({ loaderData }: Route.ComponentProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fdf8f0]">
      <div className="text-center">
        {"error" in loaderData ? (
          <>
            <p className="text-lg font-bold text-red-600">로그인 실패</p>
            <p className="mt-2 text-sm text-[#6b7a99]">{loaderData.error}</p>
            <a
              href="/login"
              className="mt-4 inline-block text-sm font-bold text-[#4caf72] underline"
            >
              다시 시도
            </a>
          </>
        ) : (
          <p className="text-sm text-[#6b7a99]">로그인 처리 중...</p>
        )}
      </div>
    </div>
  );
}
