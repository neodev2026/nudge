import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

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
