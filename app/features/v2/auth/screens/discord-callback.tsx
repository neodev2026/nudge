/**
 * /auth/discord/callback
 *
 * Handles the OAuth redirect from Discord via Supabase Auth.
 *
 * Flow:
 *   1. Exchange the OAuth code for a Supabase session
 *      (Supabase creates / updates auth.users automatically)
 *   2. Read the Discord identity from the session's user metadata
 *   3. Upsert nv2_profiles (sns_type="discord", sns_id=Discord user ID)
 *   4. If this is a brand-new profile → send a welcome DM via Discord Bot
 *   5. Redirect to /products
 *
 * Error handling:
 *   Any failure redirects to /?auth_error=<reason> so the landing page
 *   can display a user-facing toast message.
 */
import { redirect } from "react-router";
import type { Route } from "./+types/discord-callback";

import makeServerClient from "~/core/lib/supa-client.server";
import { upsertNv2Profile, getNv2ProfileByAuthUserId } from "../lib/queries.server";
import { sendWelcomeDm } from "../lib/discord.server";
import { getNv2WelcomeStage } from "~/features/v2/stage/lib/queries.server";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error_param = url.searchParams.get("error");

  // Discord / Supabase returned an error on the consent page (e.g. user denied)
  if (error_param) {
    return redirect(`/?auth_error=${encodeURIComponent(error_param)}`);
  }

  if (!code) {
    return redirect("/?auth_error=missing_code");
  }

  const [client, headers] = makeServerClient(request);

  // ── Step 1: Exchange code for session ─────────────────────────────────────
  const { data: session_data, error: session_error } =
    await client.auth.exchangeCodeForSession(code);

  if (session_error || !session_data.session) {
    console.error("[discord-callback] exchangeCodeForSession failed:", session_error);
    return redirect("/?auth_error=session_exchange_failed", { headers });
  }

  const auth_user = session_data.session.user;

  // ── Step 2: Extract Discord identity from provider metadata ───────────────
  // Supabase stores the provider's raw user object in user.user_metadata
  // Discord fields: id, username, global_name, avatar
  const meta = auth_user.user_metadata as Record<string, unknown>;

  // provider_id is the Discord user ID when using Supabase Discord OAuth
  const sns_id =
    (meta.provider_id as string | undefined) ??
    (meta.sub as string | undefined);

  if (!sns_id) {
    console.error("[discord-callback] Could not resolve Discord sns_id from metadata", meta);
    return redirect("/?auth_error=missing_discord_id", { headers });
  }

  const display_name =
    (meta.full_name as string | undefined) ??
    (meta.global_name as string | undefined) ??
    (meta.name as string | undefined) ??
    (meta.user_name as string | undefined) ??
    "Nudger";

  const avatar_url = (meta.avatar_url as string | undefined) ?? null;

  // ── Step 3: Check if this is a returning user before upsert ───────────────
  const existing_profile = await getNv2ProfileByAuthUserId(
    client,
    auth_user.id
  ).catch(() => null); // Non-fatal — treat as new user on error

  const is_new_user = existing_profile === null;

  // ── Step 4: Upsert nv2_profiles ───────────────────────────────────────────
  const profile = await upsertNv2Profile(client, {
    sns_type: "discord",
    sns_id,
    auth_user_id: auth_user.id,
    display_name,
    avatar_url,
  }).catch((err) => {
    console.error("[discord-callback] upsertNv2Profile failed:", err);
    return null;
  });

  if (!profile) {
    return redirect("/?auth_error=profile_upsert_failed", { headers });
  }

  // ── Step 5: Send welcome DM (new users only) ──────────────────────────────
  if (is_new_user) {
    const origin = new URL(request.url).origin;

    // Resolve the welcome stage for the user's first product.
    // Falls back to /products if no welcome stage exists yet.
    const welcome_stage = await getNv2WelcomeStage(client).catch(() => null);
    const welcome_url = welcome_stage
      ? `${origin}/stages/${welcome_stage.id}`
      : `${origin}/products`;

    sendWelcomeDm(sns_id, display_name, welcome_url).catch((err) => {
      // DM failure is non-fatal — log and continue
      console.error("[discord-callback] sendWelcomeDm failed:", err);
    });
  }

  // ── Step 6: Redirect to products page ─────────────────────────────────────
  return redirect("/products", { headers });
}

// No default export — this route renders nothing
