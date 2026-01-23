/**
 * Card Schedule Table
 * 
 * 학습 카드 푸시 스케줄 테이블
 * 각 사용자에게 언제 어떤 카드를 어떤 채널로 푸시할지 관리
 * 
 * 생성 시점:
 * - 신규 콘텐츠 학습 시작 시 (첫 카드 스케줄)
 * - CardFeedback 생성 시 다음 카드 스케줄 자동 생성 (SRS 알고리즘)
 * 
 * 관계:
 * - auth.users (Many-to-One): 여러 스케줄이 한 사용자에게 속함
 * - UserSNSConnection (Many-to-One): 여러 스케줄이 한 SNS 연결 사용
 * - LearningProduct (Many-to-One): 여러 스케줄이 한 상품에 속함
 * - LearningContent (Many-to-One): 여러 스케줄이 한 콘텐츠에 속함
 * - LearningCard (Many-to-One): 여러 스케줄이 한 카드 사용
 * - CardSchedule (Self-reference): 이전 스케줄 추적
 * - CardFeedback (One-to-One): 스케줄당 하나의 피드백
 * 
 * RLS 정책:
 * - Authenticated: 본인의 스케줄만 조회 가능
 * - System: INSERT/UPDATE는 시스템(트리거)이 자동 처리
 * - Admin: 모든 작업 가능
 */

import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, text, timestamp, uuid, integer, index, unique } from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { learningProduct } from '~/features/learning-product/schema';
import { learningContent } from '~/features/learning-content/schema';
import { learningCard } from '~/features/learning-card/schema';
import { userSNSConnection } from '~/features/user-sns-connection/schema';

import { DELIVERY_STATUSES } from "./constants";


/**
 * Delivery Status Enum
 * 카드 전송 상태
 */
export const deliveryStatus = pgEnum(
  "delivery_status",
  DELIVERY_STATUSES
);

export const cardSchedule = pgTable(
  'card_schedule',
  {
    // Primary Key
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    // Foreign Key: auth.users
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { 
        onDelete: 'cascade' // 사용자 삭제 시 스케줄도 삭제
      }),
    
    // Foreign Key: UserSNSConnection
    userSnsConnectionId: uuid('user_sns_connection_id')
      .notNull()
      .references(() => userSNSConnection.id, { 
        onDelete: 'restrict' // SNS 연결 삭제 시 스케줄 유지
      }),
    
    // Foreign Key: LearningProduct
    learningProductId: uuid('learning_product_id')
      .notNull()
      .references(() => learningProduct.id, { 
        onDelete: 'cascade' // 상품 삭제 시 스케줄도 삭제
      }),
    
    // Foreign Key: LearningContent
    learningContentId: uuid('learning_content_id')
      .notNull()
      .references(() => learningContent.id, { 
        onDelete: 'cascade' // 콘텐츠 삭제 시 스케줄도 삭제
      }),
    
    // Foreign Key: LearningCard
    learningCardId: uuid('learning_card_id')
      .notNull()
      .references(() => learningCard.id, { 
        onDelete: 'cascade' // 카드 삭제 시 스케줄도 삭제
      }),
    
    // 푸시 예정 시간 (UTC)
    scheduledAt: timestamp('scheduled_at', { withTimezone: true })
      .notNull(),
    
    // 실제 전송 시간 (UTC)
    sentAt: timestamp('sent_at', { withTimezone: true }),
    
    // 전송 상태
    deliveryStatus: deliveryStatus('delivery_status')
      .notNull()
      .default('pending'),
    
    // 전송 실패 시 에러 메시지
    errorMessage: text('error_message'),
    
    // Foreign Key: 이전 스케줄 (Self-reference)
    // 푸시 히스토리 추적용 (같은 콘텐츠의 이전 카드)
    previousScheduleId: uuid('previous_schedule_id')
      .references((): any => cardSchedule.id, { 
        onDelete: 'set null' // 이전 스케줄 삭제 시 NULL로 설정
      }),
    
    // Standard timestamps
    ...timestamps,
  },
  (table) => [
    // ============================================
    // INDEXES
    // ============================================
    
    // 사용자별 스케줄 조회 최적화
    index('card_schedule_user_idx')
      .on(table.userId),
    
    // 전송 대기 중인 스케줄 조회 최적화 (스케줄러용)
    index('card_schedule_pending_idx')
      .on(table.deliveryStatus, table.scheduledAt),
    
    // 사용자 + 상품별 스케줄 조회 최적화
    index('card_schedule_user_product_idx')
      .on(table.userId, table.learningProductId),
    
    // 사용자 + 콘텐츠별 스케줄 조회 최적화
    index('card_schedule_user_content_idx')
      .on(table.userId, table.learningContentId),
    
    // 사용자 + 카드별 중복 방지 체크 최적화
    index('card_schedule_user_card_status_idx')
      .on(table.userId, table.learningCardId, table.deliveryStatus),
    
    // SNS 연결별 스케줄 조회 최적화
    index('card_schedule_sns_idx')
      .on(table.userSnsConnectionId),
    
    // 전송 시간 정렬 최적화
    index('card_schedule_sent_at_idx')
      .on(table.userId, table.sentAt),
    
    // 이전 스케줄 추적 최적화
    index('card_schedule_previous_idx')
      .on(table.previousScheduleId),
    
    // ============================================
    // RLS POLICIES
    // ============================================
    
    // Policy 1: Authenticated - 본인의 스케줄만 조회 가능
    pgPolicy('card_schedule_select_own', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`${table.userId} = ${authUid}`,
    }),
    
    // Policy 2: Admin - 모든 스케줄 조회 가능
    pgPolicy('card_schedule_select_admin', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
    
    // Policy 3: System - INSERT는 시스템만 가능
    // 일반 사용자는 직접 INSERT 불가
    pgPolicy('card_schedule_insert_system', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: sql`false`, // 직접 INSERT 불가
    }),
    
    // Policy 4: Admin - Admin은 수동 INSERT 가능
    pgPolicy('card_schedule_insert_admin', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: isAdmin,
    }),
    
    // Policy 5: System - UPDATE는 시스템만 가능
    // 일반 사용자는 직접 UPDATE 불가
    pgPolicy('card_schedule_update_system', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`false`, // 직접 UPDATE 불가
      withCheck: sql`false`,
    }),
    
    // Policy 6: Admin - Admin은 수동 UPDATE 가능
    pgPolicy('card_schedule_update_admin', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
      withCheck: isAdmin,
    }),
    
    // Policy 7: DELETE는 CASCADE로 자동 삭제
    // Admin만 수동 삭제 가능
    pgPolicy('card_schedule_delete_admin', {
      for: 'delete',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),

    // n8n_worker는 모든 스케줄 접근 가능
    pgPolicy('card_schedule_n8n_worker_select', {
      for: 'select',
      to: 'n8n_worker',
      as: 'permissive',
      using: sql`true`,
    }),
  ],
);

// TypeScript 타입 추론
export type CardSchedule = typeof cardSchedule.$inferSelect;
export type NewCardSchedule = typeof cardSchedule.$inferInsert;