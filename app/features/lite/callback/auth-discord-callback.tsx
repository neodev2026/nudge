/**
 * [Discord Auth Callback Route]
 * Handles the redirect from Discord OAuth2.
 * Exchanges the code for user info and redirects to the success page.
 */
import type { Route } from "./+types/auth-discord-callback";
import { redirect } from "react-router";
import { get_discord_data, get_discord_user_id } from "../lib/discord.server";

/**
 * Loader: The heart of the OAuth2 flow.
 * 1. Extract 'code' and 'state' (which contains our product_id).
 * 2. Fetch access token and sns_id from Discord API.
 * 3. Redirect to the success page with all necessary IDs in the URL.
 */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state"); // product_id passed through OAuth 'state'

  if (!code) {
    console.error("No code provided from Discord");
    return redirect("/lite?error=auth_failed");
  }

  try {
    const redirectUri =
      process.env.DISCORD_REDIRECT_URI ??
      process.env.DISCORD_OAUTH2_REDIRECT_URI ??
      new URL("/lite/auth/discord/callback", url.origin).toString();

    // 1. Exchange code for access token
    const auth_data = await get_discord_data(code, redirectUri);
    
    // 2. Fetch the user's unique Discord ID (sns_id)
    const sns_id = await get_discord_user_id(auth_data.access_token);

    // 3. Reconstruct the destination URL
    // The 'state' param is used to persist the product_id across the OAuth flow.
    const product_id = state || "";
    
    const success_url = new URL("/lite/success", url.origin);
    success_url.searchParams.set("sns_id", sns_id);
    success_url.searchParams.set("product_id", product_id);

    // 4. Final redirect to complete onboarding
    return redirect(success_url.toString());
  } catch (error) {
    console.error("Discord callback error:", error);
    return redirect("/lite?error=server_error");
  }
}

export default function AuthDiscordCallback() {
  // This component won't render as the loader always redirects.
  return null;
}