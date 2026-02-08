import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import crypto from "node:crypto";

/**
 * Generate a secure verification token and update the connection record.
 * This token will be used in the bot deep link (e.g., t.me/bot?start=token).
 */
export const prepareVerification = async (
  client: SupabaseClient<Database>,
  { connectionId }: { connectionId: string }
) => {
  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Token valid for 10 minutes

  const { data, error } = await client
    .from("user_sns_connection")
    .update({
      verification_token: token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq("id", connectionId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Fetches the user's active SNS connection list
 */
export const getUserSnsConnections = async (
  client: SupabaseClient<Database>,
  { userId }: { userId: string }
) => {
  const { data, error } = await client
    .from("user_sns_connection")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .not("verified_at", "is", null);

  if (error) throw error;
  return data;
};

/**
 * Fetch all SNS connections for a specific user.
 */
export const getAllUserSnsConnections = async (
  client: SupabaseClient<Database>,
  { userId }: { userId: string }
) => {
  const { data, error } = await client
    .from("user_sns_connection")
    .select("*")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false });

  if (error) throw error;
  return data;
};
