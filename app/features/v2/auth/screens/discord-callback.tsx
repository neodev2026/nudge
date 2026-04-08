/**
 * /auth/discord/callback
 *
 * Handles the OAuth redirect from Discord via Supabase Auth.
 *
 * Flow:
 *   1. Exchange the OAuth code for a Supabase session
 *   2. Read the Discord identity from the session's user metadata
 *   3. Upsert nv2_profiles — includes timezone on new user creation
 *   4. If new profile → send a welcome DM via Discord Bot
 *   5. Redirect to ?next= param or /products
 *
 * Timezone:
 *   ?tz=<IANA_timezone> is forwarded from discord-start via the redirectTo URL.
 *   It is passed to upsertNv2Profile and stored only for new users.
 *   Returning users keep their existing timezone value.
 */
import { redirect } from "react-router";
import type { Route } from "./+types/discord-callback";

import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { upsertNv2Profile, getNv2ProfileByAuthUserId } from "../lib/queries.server";
import { sendWelcomeDm, addUserToGuild } from "../lib/discord.server";
import { getNv2WelcomeStage } from "~/features/v2/stage/lib/queries.server";
import { upsertNv2Subscription } from "~/features/v2/session/lib/queries.server";

// IANA timezone validation — basic check to avoid storing garbage values
function isValidIanaTimezone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error_param = url.searchParams.get("error");
  const tz_param = url.searchParams.get("tz");

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
  const meta = auth_user.user_metadata as Record<string, unknown>;

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

  // ── Step 2-b: Add user to Nudge Discord guild ─────────────────────────────
  const provider_token = session_data.session.provider_token;
  const guild_id = process.env.NUDGE_DISCORD_GUILD_ID;

  if (provider_token && guild_id) {
    addUserToGuild(provider_token, sns_id, guild_id).catch((err) => {
      console.error("[discord-callback] addUserToGuild failed:", err);
    });
  } else {
    console.warn(
      "[discord-callback] Skipping addUserToGuild — missing provider_token or NUDGE_DISCORD_GUILD_ID"
    );
  }

  // ── Step 3: Check if this is a returning user before upsert ───────────────
  const existing_profile = await getNv2ProfileByAuthUserId(
    client,
    auth_user.id
  ).catch(() => null);

  const is_new_user = existing_profile === null;

  // ── Step 4: Resolve timezone ───────────────────────────────────────────────
  // Use browser-captured timezone if valid; fall back to DB default ("Asia/Seoul")
  const timezone =
    tz_param && isValidIanaTimezone(tz_param) ? tz_param : null;

  // ── Step 5: Upsert nv2_profiles ───────────────────────────────────────────
  const profile = await upsertNv2Profile(adminClient, {
    sns_type: "discord",
    sns_id,
    auth_user_id: auth_user.id,
    display_name,
    avatar_url,
    timezone, // null for returning users → existing value is preserved
  }).catch((err) => {
    console.error("[discord-callback] upsertNv2Profile failed:", err);
    return null;
  });

  if (!profile) {
    return redirect("/?auth_error=profile_upsert_failed", { headers });
  }

  // ── Step 6: Send welcome DM (new users only) ──────────────────────────────
  if (is_new_user) {
    const origin = new URL(request.url).origin;

    const welcome_stage = await getNv2WelcomeStage(client).catch(() => null);
    const welcome_url = welcome_stage
      ? `${origin}/stages/${welcome_stage.id}`
      : `${origin}/products`;

    if (welcome_stage?.learning_product_id) {
      await upsertNv2Subscription(
        adminClient,
        "discord",
        sns_id,
        welcome_stage.learning_product_id
      ).catch((err) => {
        console.error("[discord-callback] upsertNv2Subscription failed:", err);
      });
    }

    sendWelcomeDm(sns_id, display_name, welcome_url).catch((err) => {
      console.error("[discord-callback] sendWelcomeDm failed:", err);
    });
  }

  // ── Step 7: Redirect ───────────────────────────────────────────────────────
  const next_param = url.searchParams.get("next");
  const redirect_to =
    next_param && next_param.startsWith("/") ? next_param : "/products";

  return redirect(redirect_to, { headers });
}

// No default export — this route renders nothing
