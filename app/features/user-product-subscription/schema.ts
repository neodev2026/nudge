import { sql } from "drizzle-orm";
import { 
  boolean, 
  pgPolicy, 
  pgEnum, 
  pgTable, 
  time, 
  timestamp, 
  uuid, 
  integer, 
  index, 
  unique 
} from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { learningProduct } from '~/features/learning-product/schema';
import { userSNSConnection } from '~/features/user-sns-connection/schema';

import { SUBSCRIPTION_TIERS } from "./constants";

/**
 * [wemake Style] 구독 티어 Enum 정의
 */
export const subscriptionTier = pgEnum(
  "subscription_tier",
  SUBSCRIPTION_TIERS
);

/**
 * User Product Subscription Table
 * 사용자의 제품 구독 상태 및 푸시 발송 제어를 관리합니다.
 */
export const userProductSubscription = pgTable(
  'user_product_subscription',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    // 외래키 설정
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    
    learningProductId: uuid('learning_product_id')
      .notNull()
      .references(() => learningProduct.id, { onDelete: 'cascade' }),
    
    userSnsConnectionId: uuid('user_sns_connection_id')
      .notNull()
      .references(() => userSNSConnection.id, { onDelete: 'restrict' }),

    // 구독 플랜 정보
    subscriptionTier: subscriptionTier('subscription_tier')
      .notNull()
      .default('basic'),
    
    isActive: boolean('is_active')
      .notNull()
      .default(true),
    
    // 알림 설정
    pushEnabled: boolean('push_enabled')
      .notNull()
      .default(true),
    
    preferredPushTime: time('preferred_push_time'),

    // 학습 통계 (제품 내 모든 단어의 평균 진도)
    memoryPercentage: integer('memory_percentage')
      .notNull()
      .default(0),

    // n8n 워커가 다음 발송 시간을 계산하기 위한 기준점
    lastCardSentAt: timestamp('last_card_sent_at', { withTimezone: true }),
    
    subscribedAt: timestamp('subscribed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    
    ...timestamps,
  },
  (table) => [
    // 한 사용자가 동일 제품을 중복 구독하는 것을 방지
    unique('user_product_subscription_unique').on(table.userId, table.learningProductId),
    
    // [최적화] n8n 워커의 발송 대상 추출 쿼리 성능 향상용 인덱스
    index('user_sub_worker_batch_idx').on(table.isActive, table.pushEnabled, table.lastCardSentAt),
    index('user_sub_tier_check_idx').on(table.subscriptionTier, table.lastCardSentAt),

    // 기본 검색용 인덱스
    index('user_subscription_user_idx').on(table.userId),
    index('user_subscription_sns_idx').on(table.userSnsConnectionId),
    index('user_subscription_product_idx').on(table.learningProductId),
    
    /**
     * RLS Policies
     */
    
    // 1. 일반 사용자: 본인의 구독 정보 조회 및 설정 변경 가능
    pgPolicy('user_subscription_select_own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('user_subscription_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('user_subscription_update_own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),

    // 2. n8n_worker: 전역에서 발송 대상 조회 및 전송 시간 업데이트 허용
    pgPolicy('user_subscription_worker_manage', {
      for: 'all',
      to: 'n8n_worker',
      as: 'permissive',
      using: sql`true`,
      withCheck: sql`true`,
    }),

    // 3. Admin: 관리자 헬퍼 함수를 이용한 전체 접근
    pgPolicy('user_subscription_admin_all', {
      for: 'all',
      to: authenticatedRole,
      using: isAdmin,
    }),
  ],
);

export type UserProductSubscription = typeof userProductSubscription.$inferSelect;
export type NewUserProductSubscription = typeof userProductSubscription.$inferInsert;