// app/features/learning-card/queries.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import { calculateNextReview } from "~/core/lib/utils";
import { learningContentProgress } from "./schema";

/**
 * Content ID로 생성된 모든 학습 카드를 조회합니다.
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
 * 단어 단위의 통합 학습 진도를 업데이트(Upsert)합니다.
 */
export const upsertContentProgress = async (
  client: SupabaseClient<Database>,
  { 
    contentId, 
    userId, 
    quality 
  }: { 
    contentId: string; 
    userId: string; 
    quality: number 
  }
) => {
  // 1. 기존 진도 정보 조회 (없을 경우 기본값 적용을 위해 single() 대신 select() 사용 가능)
  const { data: current } = await client
    .from("learning_content_progress")
    .select("*")
    .eq("learning_content_id", contentId)
    .eq("user_id", userId)
    .maybeSingle();

  // 2. SM-2 알고리즘으로 다음 상태 계산
  const nextState = calculateNextReview(quality, current ? {
    iteration: current.iteration,
    interval: current.interval,
    easiness: current.easiness
  } : undefined);

  // 3. 다음 복습 시점에 보여줄 카드 인덱스 결정 (순차 회전)
  const nextCardIndex = ((current?.current_card_index ?? 0) + 1) % 10; // 상수 기반으로 변경 가능

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + nextState.interval);

  // 4. 데이터베이스 반영 (Upsert)
  const { data, error } = await client
    .from("learning_content_progress")
    .upsert({
      user_id: userId,
      learning_content_id: contentId,
      iteration: nextState.iteration,
      easiness: nextState.easiness,
      interval: nextState.interval,
      current_card_index: nextCardIndex,
      next_review_at: nextReviewAt.toISOString(),
      last_review_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};