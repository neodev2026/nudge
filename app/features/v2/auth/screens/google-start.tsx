/**
 * GET /auth/google/start?next=<url>
 *
 * Initiates Google OAuth via Supabase.
 * Encodes ?next= in the redirectTo URL path so Supabase preserves it through the callback.
 */
import type { Route } from "./+types/google-start";
import { data, redirect } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next") ?? "/products";

  const [client, headers] = makeServerClient(request);

  // Encode next in the callback URL path segment so Supabase preserves it.
  // Supabase appends ?code=... to redirectTo, keeping our ?next= intact.
  const callback_url = `${process.env.SITE_URL}/auth/google/callback?next=${encodeURIComponent(next)}`;

  const { data: signInData, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback_url,
      queryParams: {
        prompt: "select_account",  // Always show Google account selector
      },
    },
  });

  if (error || !signInData?.url) {
    return data({ error: error?.message ?? "OAuth 시작 실패" }, { status: 400 });
  }

  return redirect(signInData.url, { headers });
}

export default function GoogleStart() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fdf8f0]">
      <p className="text-sm text-[#6b7a99]">Google로 이동 중...</p>
    </div>
  );
}
