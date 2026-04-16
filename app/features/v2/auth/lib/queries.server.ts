import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpsertNv2ProfileParams {
  auth_user_id: string;
  discord_id?: string | null;  // Set on Discord OAuth sign-in
  email?: string | null;        // Set on Google/email sign-in
  display_name?: string | null;
  avatar_url?: string | null;
  timezone?: string | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Upserts a row in nv2_profiles.
 * On conflict (auth_user_id), updates display info and channel IDs.
 * timezone is only written on INSERT (new user).
 */
export async function upsertNv2Profile(
  client: SupabaseClient<Database>,
  params: UpsertNv2ProfileParams
) {
  const { auth_user_id, discord_id, email, display_name, avatar_url, timezone } = params;

  const { data: existing } = await client
    .from("nv2_profiles")
    .select("auth_user_id, timezone")
    .eq("auth_user_id", auth_user_id)
    .maybeSingle();

  const upsert_data: Record<string, unknown> = {
    auth_user_id,
    display_name: display_name ?? null,
    avatar_url: avatar_url ?? null,
  };

  if (discord_id) upsert_data.discord_id = discord_id;
  if (email) upsert_data.email = email;
  if (!existing && timezone) upsert_data.timezone = timezone;

  const { data, error } = await client
    .from("nv2_profiles")
    .upsert(upsert_data as any, {
      onConflict: "auth_user_id",
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetches an nv2_profile by Supabase auth user id.
 * Returns null when the profile does not exist yet.
 */
export async function getNv2ProfileByAuthUserId(
  client: SupabaseClient<Database>,
  auth_user_id: string
) {
  const { data, error } = await client
    .from("nv2_profiles")
    .select("*")
    .eq("auth_user_id", auth_user_id)
    .maybeSingle();

  if (error) throw error;
  return data;
}
