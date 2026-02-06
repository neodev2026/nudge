import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";

/**
 *  활성화된 모든 학습 제품(단어장) 목록을 조회합니다.
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

/**
 * ID를 통해 특정 학습 제품의 상세 정보를 조회합니다.
 */
export const getProductById = async (
    client: SupabaseClient<Database>,
    { productId }: { productId: string }
  ) => {
    const { data, error } = await client
      .from("learning_product")
      .select("*")
      .eq("id", productId)
      .single();
  
    if (error) throw error;
    return data;
  };