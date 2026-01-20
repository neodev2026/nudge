/**
 * User Learning Content Progress Table
 * 
 * 사용자별 학습 콘텐츠 진행 상황 추적 테이블
 * 각 사용자가 각 콘텐츠를 얼마나 학습했는지, 마지막 피드백 점수는 무엇인지 등을 기록
 * 
 * 생성 시점:
 * - UserProductSubscription 생성 시 해당 상품의 모든 LearningContent에 대해 자동 생성
 * 
 * 업데이트 시점:
 * - CardFeedback 생성 시마다 자동 업데이트
 * 
 * 관계:
 * - auth.users (Many-to-One): 여러 진행상황이 한 사용자에게 속함
 * - LearningProduct (Many-to-One): 여러 진행상황이 한 상품에 속함
 * - LearningContent (Many-to-One): 여러 진행상황이 한 콘텐츠에 속함
 * 
 * RLS 정책:
 * - Authenticated: 본인의 진행 상황만 조회 가능
 * - Admin: 모든 사용자의 진행 상황 조회 가능
 */

import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, timestamp, uuid, integer, index, unique } from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { learningProduct } from '~/features/learning-product/schema';
import { learningContent } from '~/features/learning-content/schema';


export const userLearningContentProgress = pgTable(
  'user_learning_content_progress',
  {
    // Primary Key
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    // Foreign Key: auth.users
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { 
        onDelete: 'cascade' // 사용자 삭제 시 진행 상황도 삭제
      }),
    
    // Foreign Key: LearningProduct
    learningProductId: uuid('learning_product_id')
      .notNull()
      .references(() => learningProduct.id, { 
        onDelete: 'cascade' // 상품 삭제 시 진행 상황도 삭제
      }),
    
    // Foreign Key: LearningContent
    learningContentId: uuid('learning_content_id')
      .notNull()
      .references(() => learningContent.id, { 
        onDelete: 'cascade' // 콘텐츠 삭제 시 진행 상황도 삭제
      }),
    
    // 마지막 학습 시간 (UTC)
    lastStudiedAt: timestamp('last_studied_at', { withTimezone: true }),
    
    // 총 학습 횟수
    studyCount: integer('study_count')
      .notNull()
      .default(0),
    
    // 마지막 피드백 점수 (1-10)
    lastFeedbackScore: integer('last_feedback_score'),
    
    // Standard timestamps
    ...timestamps,
  },
  (table) => [
    // ============================================
    // CONSTRAINTS
    // ============================================
    
    // Unique constraint: 한 사용자는 같은 상품의 같은 콘텐츠에 대해 하나의 진행 상황만 가짐
    unique('user_content_progress_unique')
      .on(table.userId, table.learningProductId, table.learningContentId),
    
    // ============================================
    // INDEXES
    // ============================================
    
    // 사용자별 진행 상황 조회 최적화
    index('user_progress_user_idx')
      .on(table.userId),
    
    // 사용자 + 상품별 진행 상황 조회 최적화
    index('user_progress_user_product_idx')
      .on(table.userId, table.learningProductId),
    
    // 마지막 학습 시간 기준 정렬 최적화
    index('user_progress_user_product_studied_idx')
      .on(table.userId, table.learningProductId, table.lastStudiedAt),
    
    // 피드백 점수별 필터링 최적화 (복습 필요한 콘텐츠 찾기)
    index('user_progress_feedback_score_idx')
      .on(table.userId, table.lastFeedbackScore),
    
    // ============================================
    // RLS POLICIES
    // ============================================
    
    // Policy 1: Authenticated - 본인의 진행 상황만 조회 가능
    pgPolicy('user_progress_select_own', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`${table.userId} = ${authUid}`,
    }),
    
    // Policy 2: Admin - 모든 사용자의 진행 상황 조회 가능
    pgPolicy('user_progress_select_admin', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
    
    // Policy 3: System - INSERT는 시스템(트리거)이 자동 생성
    // 일반 사용자는 INSERT 불가 (UserProductSubscription 생성 시 자동)
    pgPolicy('user_progress_insert_system', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: sql`false`, // 직접 INSERT 불가
    }),
    
    // Policy 4: Admin - Admin은 수동 INSERT 가능
    pgPolicy('user_progress_insert_admin', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: isAdmin,
    }),
    
    // Policy 5: System - UPDATE는 시스템(트리거)이 자동 업데이트
    // 일반 사용자는 UPDATE 불가 (CardFeedback 생성 시 자동)
    pgPolicy('user_progress_update_system', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`false`, // 직접 UPDATE 불가
      withCheck: sql`false`,
    }),
    
    // Policy 6: Admin - Admin은 수동 UPDATE 가능
    pgPolicy('user_progress_update_admin', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
      withCheck: isAdmin,
    }),
    
    // Policy 7: DELETE는 CASCADE로 자동 삭제되므로 별도 정책 불필요
    // 하지만 Admin이 수동 삭제할 수 있도록 허용
    pgPolicy('user_progress_delete_admin', {
      for: 'delete',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
  ],
);

// TypeScript 타입 추론
export type UserLearningContentProgress = typeof userLearningContentProgress.$inferSelect;
export type NewUserLearningContentProgress = typeof userLearningContentProgress.$inferInsert;