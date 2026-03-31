import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import type { SnsType } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpsertNv2ProfileParams {
  sns_type: "discord" | "kakao" | "telegram" | "email";
  sns_id: string;
  auth_user_id: string;
  display_name?: string | null;
  avatar_url?: string | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Upserts a row in nv2_profiles.
 *
 * Called during the OAuth callback after Supabase auth.users is created.
 * On conflict (sns_type, sns_id), updates auth_user_id and display info
 * so re-connecting always keeps the profile in sync with the SNS provider.
 *
 * Returns the upserted profile row.
 */
export async function upsertNv2Profile(
  client: SupabaseClient<Database>,
  params: UpsertNv2ProfileParams
) {
  const { sns_type, sns_id, auth_user_id, display_name, avatar_url } = params;

  const { data, error } = await client
    .from("nv2_profiles")
    .upsert(
      {
        sns_type,
        sns_id,
        auth_user_id,
        display_name: display_name ?? null,
        avatar_url: avatar_url ?? null,
      },
      {
        // Composite PK — conflict on (sns_type, sns_id)
        onConflict: "sns_type,sns_id",
        // Keep display info up to date on every login
        ignoreDuplicates: false,
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetches an nv2_profile by Supabase auth user id.
 *
 * Returns null when the profile does not exist yet (first-time OAuth callback
 * before upsertNv2Profile has been called).
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
  return data; // null when not found
}

/**
 * Fetches an nv2_profile by (sns_type, sns_id).
 *
 * Used by cron dispatchers and stage completion handlers to look up
 * the profile without knowing the auth_user_id.
 *
 * Returns null when the profile does not exist.
 */
export async function getNv2ProfileBySnsId(
  client: SupabaseClient<Database>,
  sns_type: SnsType,
  sns_id: string
) {
  const { data, error } = await client
    .from("nv2_profiles")
    .select("*")
    .eq("sns_type", sns_type)
    .eq("sns_id", sns_id)
    .maybeSingle();

  if (error) throw error;
  return data; // null when not found
}
