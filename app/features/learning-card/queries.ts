import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

/**
 * Fetches all cards associated with a specific content ID.
 */
export const getCardsByContentId = async (
  client: SupabaseClient<Database>,
  { contentId }: { contentId: string }
) => {
  const { data, error } = await client
    .from("learning_card")
    .select("*")
    .eq("learning_content_id", contentId);

  if (error) throw error;
  return data;
};

/**
 * Fetches the current progress for a user and content.
 * Note: SM-2 calculations are now handled by n8n Flow 3.
 */
export const getContentProgress = async (
  client: SupabaseClient<Database>,
  { contentId, userId }: { contentId: string; userId: string }
) => {
  const { data, error } = await client
    .from("learning_content_progress")
    .select("*")
    .eq("learning_content_id", contentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};