/**
 * /auth/discord/start
 *
 * Initiates the Discord OAuth flow via Supabase Auth.
 * This route has no UI — the loader immediately redirects the browser
 * to Discord's OAuth consent page.
 *
 * Flow:
 *   GET /auth/discord/start
 *     → supabase.auth.signInWithOAuth({ provider: "discord" })
 *     → redirect to Discord consent page
 *     → Discord redirects back to /auth/discord/callback
 */
import { redirect } from "react-router";
import type { Route } from "./+types/discord-start";

import makeServerClient from "~/core/lib/supa-client.server";

export async function loader({ request }: Route.LoaderArgs) {
  const [client, headers] = makeServerClient(request);

  const origin = new URL(request.url).origin;
  const redirect_to = `${origin}/auth/discord/callback`;

  const { data, error } = await client.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: redirect_to,
      // Request only the identity scope — no guild or message permissions needed
      scopes: "identify",
    },
  });

  if (error || !data.url) {
    // Redirect back to home with an error flag so the UI can show a toast
    return redirect("/?auth_error=discord_start_failed", { headers });
  }

  return redirect(data.url, { headers });
}

// No default export — this route renders nothing
