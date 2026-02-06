import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

/**
 * [wemake Style] 활성화된 모든 학습 제품(단어장) 목록을 조회합니다.
 */
export const getLearningProducts = async (client: SupabaseClient<Database>) => {
  const { data, error } = await client
    .from("learning_product")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};