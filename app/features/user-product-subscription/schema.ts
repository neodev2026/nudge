import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, time, timestamp, uuid, integer, index, unique } from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { learningProduct } from '~/features/learning-product/schema';
import { userSNSConnection } from '~/features/user-sns-connection/schema';

import { SUBSCRIPTION_TIERS } from "./constants";


export const subscriptionTier = pgEnum(
  "subscription_tier",
  SUBSCRIPTION_TIERS
);


/**
 * User Product Subscription Table
 */
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
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    
    // Foreign Key: LearningProduct
    learningProductId: uuid('learning_product_id')
      .notNull()
      .references(() => learningProduct.id, { onDelete: 'cascade' }),
    
    // Foreign Key: UserSNSConnection
    userSnsConnectionId: uuid('user_sns_connection_id')
      .notNull()
      .references(() => userSNSConnection.id, { onDelete: 'restrict' }),

    // [변경 사항] 구독 플랜 티어 추가
    subscriptionTier: subscriptionTier('subscription_tier')
      .notNull()
      .default('basic'),
    
    // 구독 활성화 여부
    isActive: boolean('is_active')
      .notNull()
      .default(true),
    
    // 푸시 활성화 여부
    pushEnabled: boolean('push_enabled')
      .notNull()
      .default(true),
    
    // 기억 수치 (0-100%)
    memoryPercentage: integer('memory_percentage')
      .notNull()
      .default(0),
    
    // 선호하는 푸시 시간
    preferredPushTime: time('preferred_push_time'),

    // [변경 사항] 마지막 카드 발송 시간 (티어별 인터벌 계산용)
    lastCardSentAt: timestamp('last_card_sent_at', { withTimezone: true }),
    
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
    // Constraints
    unique('user_product_subscription_unique')
      .on(table.userId, table.learningProductId),
    
    // Indexes
    index('user_subscription_user_idx').on(table.userId),
    index('user_subscription_active_idx').on(table.userId, table.isActive),
    
    // [변경 사항] 티어별 조회 및 발송 대상 추출 최적화 인덱스 추가
    index('user_subscription_tier_idx').on(table.subscriptionTier),
    index('user_subscription_last_sent_idx').on(table.lastCardSentAt),

    index('user_subscription_push_enabled_idx').on(table.pushEnabled),
    index('user_subscription_sns_idx').on(table.userSnsConnectionId),
    index('user_subscription_product_idx').on(table.learningProductId),
    
    // RLS Policies (기존 정책 유지)
    pgPolicy('user_subscription_select_own', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('user_subscription_select_admin', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
    pgPolicy('user_subscription_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy('user_subscription_update_own', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    // ... (기본 Admin 정책 생략 가능하나 원본 유지 권장)
  ],
);

export type UserProductSubscription = typeof userProductSubscription.$inferSelect;
export type NewUserProductSubscription = typeof userProductSubscription.$inferInsert;