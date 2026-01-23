/**
 * Card Feedback Table
 * 
 * 카드 피드백 기록 테이블
 * 사용자가 학습 카드에 대해 제공한 피드백(1-10점)을 기록
 * 
 * 생성 시점:
 * - 사용자가 학습 카드를 확인하고 기억 정도 피드백 제출 시
 * 
 * 관계:
 * - auth.users (Many-to-One): 여러 피드백이 한 사용자에게 속함
 * - LearningProduct (Many-to-One): 여러 피드백이 한 상품에 속함
 * - LearningContent (Many-to-One): 여러 피드백이 한 콘텐츠에 속함
 * - LearningCard (Many-to-One): 여러 피드백이 한 카드에 속함
 * - CardSchedule (One-to-One): 한 스케줄당 하나의 피드백
 * 
 * RLS 정책:
 * - Authenticated: 본인의 피드백만 조회/생성 가능
 * - Admin: 모든 작업 가능
 * - UPDATE/DELETE: 불가 (로그 데이터 무결성 보존)
 */

import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, text, timestamp, uuid, integer, index, jsonb } from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { learningProduct } from '~/features/learning-product/schema';
import { learningContent } from '~/features/learning-content/schema';
import { learningCard } from '~/features/learning-card/schema';

import { PUSH_CHANNELS } from "./constants";

/**
 * Push Channel Enum
 * 푸시 채널 타입
 */
export const pushChannel = pgEnum(
  "push_channel",
  PUSH_CHANNELS
);

export const cardFeedback = pgTable(
  'card_feedback',
  {
    // Primary Key
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    // Foreign Key: auth.users
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { 
        onDelete: 'cascade' // 사용자 삭제 시 피드백도 삭제
      }),
    
    // Foreign Key: LearningProduct
    learningProductId: uuid('learning_product_id')
      .notNull()
      .references(() => learningProduct.id, { 
        onDelete: 'cascade' // 상품 삭제 시 피드백도 삭제
      }),
    
    // Foreign Key: LearningContent
    learningContentId: uuid('learning_content_id')
      .notNull()
      .references(() => learningContent.id, { 
        onDelete: 'cascade' // 콘텐츠 삭제 시 피드백도 삭제
      }),
    
    // Foreign Key: LearningCard
    learningCardId: uuid('learning_card_id')
      .notNull()
      .references(() => learningCard.id, { 
        onDelete: 'cascade' // 카드 삭제 시 피드백도 삭제
      }),
    
    // 피드백 점수 (1-10)
    feedbackScore: integer('feedback_score')
      .notNull(),
    
    // 카드 열어본 시간 (UTC)
    cardOpenedAt: timestamp('card_opened_at', { withTimezone: true })
      .notNull(),
    
    // 피드백 버튼 누른 시간 (UTC)
    feedbackSubmittedAt: timestamp('feedback_submitted_at', { withTimezone: true })
      .notNull(),
    
    // 계산값: feedback_submitted_at - card_opened_at (초 단위)
    timeSpentSeconds: integer('time_spent_seconds'),
    
    // 디바이스 정보 (JSONB)
    // 예: { "type": "mobile", "os": "ios", "browser": "safari" }
    deviceInfo: jsonb('device_info')
      .$type<{
        type?: string;
        os?: string;
        browser?: string;
      }>(),
    
    // 어떤 채널로 푸시받았는지
    pushChannel: pushChannel('push_channel')
      .notNull(),
    
    // 재학습 여부
    isReview: boolean('is_review')
      .notNull()
      .default(false),
    
    // 직전 피드백 점수
    previousFeedbackScore: integer('previous_feedback_score'),
    
    // 몇 번째 학습인지
    cardPresentationCount: integer('card_presentation_count')
      .notNull()
      .default(1),
    
    // Standard timestamps (created_at only, no updated_at)
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    // ============================================
    // INDEXES
    // ============================================
    
    // 사용자별 하루 학습 카드 수 COUNT 최적화
    // 무료 사용자 제한(10개/일) 확인용
    index('card_feedback_user_created_at_idx')
      .on(table.userId, table.createdAt),
    
    // 사용자별 피드백 조회 최적화
    index('card_feedback_user_idx')
      .on(table.userId),
    
    // 상품별 피드백 통계 조회 최적화
    index('card_feedback_learning_product_idx')
      .on(table.learningProductId),
    
    // 콘텐츠별 피드백 통계 조회 최적화
    index('card_feedback_learning_content_idx')
      .on(table.learningContentId),
    
    // 카드별 피드백 통계 조회 최적화
    index('card_feedback_learning_card_idx')
      .on(table.learningCardId),
    
    // 사용자 + 상품별 피드백 조회 최적화
    index('card_feedback_user_product_idx')
      .on(table.userId, table.learningProductId),
    
    // 사용자 + 콘텐츠별 피드백 조회 최적화
    index('card_feedback_user_content_idx')
      .on(table.userId, table.learningContentId),
    
    // 사용자 + 카드별 피드백 히스토리 조회 최적화
    index('card_feedback_user_card_idx')
      .on(table.userId, table.learningCardId),
    
    // 피드백 점수별 필터링 최적화
    index('card_feedback_score_idx')
      .on(table.feedbackScore),
    
    // 재학습 여부별 필터링 최적화
    index('card_feedback_is_review_idx')
      .on(table.isReview),
    
    // ============================================
    // RLS POLICIES
    // ============================================
    
    // Policy 1: Authenticated - 본인의 피드백만 조회 가능
    pgPolicy('card_feedback_select_own', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`${table.userId} = ${authUid}`,
    }),
    
    // Policy 2: Admin - 모든 피드백 조회 가능
    pgPolicy('card_feedback_select_admin', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
    
    // Policy 3: Authenticated - 본인의 피드백만 생성 가능
    pgPolicy('card_feedback_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    
    // Policy 4: Admin - Admin은 모든 피드백 생성 가능
    pgPolicy('card_feedback_insert_admin', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: isAdmin,
    }),
    
    // Policy 5: UPDATE 불가 (데이터 무결성 보존)
    // 피드백은 한 번 제출되면 수정 불가
    pgPolicy('card_feedback_update_none', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`false`,
      withCheck: sql`false`,
    }),
    
    // Policy 6: DELETE 불가 (로그 보존)
    // 피드백은 학습 히스토리이므로 삭제 불가
    pgPolicy('card_feedback_delete_none', {
      for: 'delete',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`false`,
    }),
  ],
);

// TypeScript 타입 추론
export type CardFeedback = typeof cardFeedback.$inferSelect;
export type NewCardFeedback = typeof cardFeedback.$inferInsert;