/**
 * User Product Subscription Table
 * 
 * 사용자-상품 구독 관리 테이블
 * 각 사용자가 어떤 학습 상품을 구독했는지, 어떤 채널로 푸시받을지 관리
 * 
 * 생성 시점:
 * - 사용자가 학습 상품을 구독할 때
 * - 동시에 UserLearningContentProgress 레코드들이 자동 생성됨 (트리거)
 * 
 * 관계:
 * - auth.users (Many-to-One): 여러 구독이 한 사용자에게 속함
 * - LearningProduct (Many-to-One): 여러 구독이 한 상품에 속함
 * - UserSNSConnection (Many-to-One): 여러 구독이 한 SNS 연결을 사용
 * - UserLearningContentProgress (One-to-Many): 한 구독에 여러 진행 상황
 * - CardSchedule (One-to-Many): 한 구독에서 여러 카드 푸시
 * 
 * RLS 정책:
 * - Authenticated: 본인의 구독만 CRUD 가능
 * - Admin: 모든 사용자의 구독 조회 가능
 */

import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, time, timestamp, uuid, integer, index, unique } from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { learningProduct } from '~/features/learning-product/schema';
import { learningContent } from '~/features/learning-content/schema';
import { userSNSConnection } from '~/features/user-sns-connection/schema';


export const userProductSubscription = pgTable(
  'user_product_subscription',
  {
    // Primary Key
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    // Foreign Key: auth.users
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { 
        onDelete: 'cascade' // 사용자 삭제 시 구독도 삭제
      }),
    
    // Foreign Key: LearningProduct
    learningProductId: uuid('learning_product_id')
      .notNull()
      .references(() => learningProduct.id, { 
        onDelete: 'cascade' // 상품 삭제 시 구독도 삭제
      }),
    
    // Foreign Key: UserSNSConnection
    // 이 구독의 푸시를 받을 SNS 채널
    userSnsConnectionId: uuid('user_sns_connection_id')
      .notNull()
      .references(() => userSNSConnection.id, { 
        onDelete: 'restrict' // SNS 연결 삭제 시 구독은 유지 (연결 변경 필요)
      }),
    
    // 구독 활성화 여부
    isActive: boolean('is_active')
      .notNull()
      .default(true),
    
    // 푸시 활성화 여부 (일시정지)
    pushEnabled: boolean('push_enabled')
      .notNull()
      .default(true),
    
    // 기억 수치 (0-100%)
    // CardFeedback 기반으로 계산되어 업데이트됨
    memoryPercentage: integer('memory_percentage')
      .notNull()
      .default(0),
    
    // 선호하는 푸시 시간 (예: 09:00, 14:00)
    // NULL이면 기본 시간대 사용
    preferredPushTime: time('preferred_push_time'),
    
    // 구독 시작 시간
    subscribedAt: timestamp('subscribed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    
    // 구독 해지 시간
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    
    // Standard timestamps
    ...timestamps,
  },
  (table) => [
    // ============================================
    // CONSTRAINTS
    // ============================================
    
    // Unique constraint: 한 사용자는 같은 상품을 한 번만 구독 가능
    unique('user_product_subscription_unique')
      .on(table.userId, table.learningProductId),
    
    // ============================================
    // INDEXES
    // ============================================
    
    // 사용자별 구독 조회 최적화
    index('user_subscription_user_idx')
      .on(table.userId),
    
    // 활성 구독 조회 최적화
    index('user_subscription_active_idx')
      .on(table.userId, table.isActive),
    
    // 푸시 활성화된 구독 조회 최적화
    index('user_subscription_push_enabled_idx')
      .on(table.pushEnabled),
    
    // SNS 연결별 구독 조회 최적화
    index('user_subscription_sns_idx')
      .on(table.userSnsConnectionId),
    
    // 상품별 구독자 수 조회 최적화
    index('user_subscription_product_idx')
      .on(table.learningProductId),
    
    // ============================================
    // RLS POLICIES
    // ============================================
    
    // Policy 1: Authenticated - 본인의 구독만 조회 가능
    pgPolicy('user_subscription_select_own', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`${table.userId} = ${authUid}`,
    }),
    
    // Policy 2: Admin - 모든 사용자의 구독 조회 가능
    pgPolicy('user_subscription_select_admin', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
    
    // Policy 3: Authenticated - 본인의 구독만 생성 가능
    pgPolicy('user_subscription_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    
    // Policy 4: Admin - Admin은 모든 구독 생성 가능
    pgPolicy('user_subscription_insert_admin', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: isAdmin,
    }),
    
    // Policy 5: Authenticated - 본인의 구독만 수정 가능
    pgPolicy('user_subscription_update_own', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    
    // Policy 6: Admin - Admin은 모든 구독 수정 가능
    pgPolicy('user_subscription_update_admin', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
      withCheck: isAdmin,
    }),
    
    // Policy 7: Authenticated - 본인의 구독만 삭제 가능 (실제로는 is_active=false 사용)
    pgPolicy('user_subscription_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`${table.userId} = ${authUid}`,
    }),
    
    // Policy 8: Admin - Admin은 모든 구독 삭제 가능
    pgPolicy('user_subscription_delete_admin', {
      for: 'delete',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
  ],
);

// TypeScript 타입 추론
export type UserProductSubscription = typeof userProductSubscription.$inferSelect;
export type NewUserProductSubscription = typeof userProductSubscription.$inferInsert;