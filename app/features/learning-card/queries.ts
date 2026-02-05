// app/features/learning-card/queries.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

/**
 * [wemake Style] Content ID로 생성된 모든 학습 카드를 조회합니다.
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