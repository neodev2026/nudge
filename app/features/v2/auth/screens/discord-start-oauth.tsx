/**
 * /auth/discord/start-oauth
 *
 * Performs the actual Supabase Discord OAuth redirect.
 * Called by /auth/discord/start after the browser timezone has been captured.
 *
 * Accepts:
 *   ?next=<path>        — post-auth redirect destination (optional)
 *   ?tz=<IANA_timezone> — browser timezone captured by discord-start (optional)
 *
 * Both params are forwarded into the redirectTo callback URL so they survive
 * the Discord OAuth round-trip and are available in discord-callback.
 */
import { redirect } from "react-router";
import type { Route } from "./+types/discord-start-oauth";
import makeServerClient from "~/core/lib/supa-client.server";

export async function loader({ request }: Route.LoaderArgs) {
  const [client, headers] = makeServerClient(request);

  const url_obj = new URL(request.url);
  const next_param = url_obj.searchParams.get("next");
  const tz_param = url_obj.searchParams.get("tz");

  const origin = url_obj.origin;
  const callback_base = `${origin}/auth/discord/callback`;

  // Forward both next and tz into the callback URL
  const callback_params = new URLSearchParams();
  if (next_param) callback_params.set("next", next_param);
  if (tz_param)   callback_params.set("tz", tz_param);
  const callback_qs = callback_params.toString();
  const redirect_to = callback_base + (callback_qs ? `?${callback_qs}` : "");

  const { data, error } = await client.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: redirect_to,
      // identify  : read basic Discord profile (required)
      // guilds.join: allows the bot to add user to Nudge guild so DMs work
      scopes: "identify guilds.join",
    },
  });

  if (error || !data.url) {
    return redirect("/?auth_error=discord_start_failed", { headers });
  }

  return redirect(data.url, { headers });
}

// No default export — this route renders nothing
