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
 * Subscription Tier Enum Definition
 */
export const subscriptionTier = pgEnum(
  "subscription_tier",
  SUBSCRIPTION_TIERS
);

/**
 * User Product Subscription Table
 * Manages the user's subscription status per product and controls notification delivery.
 */
export const userProductSubscription = pgTable(
  'user_product_subscription',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    // Foreign Key Relationships
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    
    learningProductId: uuid('learning_product_id')
      .notNull()
      .references(() => learningProduct.id, { onDelete: 'cascade' }),
    
    userSnsConnectionId: uuid('user_sns_connection_id')
      .notNull()
      .references(() => userSNSConnection.id, { onDelete: 'restrict' }),

    // Subscription Plan Details
    subscriptionTier: subscriptionTier('subscription_tier')
      .notNull()
      .default('basic'),
    
    /**
     * Daily learning goal for the product.
     * Defines how many new learning contents (e.g., words) should be introduced daily.
     */
    dailyGoal: integer('daily_goal')
      .notNull()
      .default(10),

    /**
     * Time delay (in seconds) before the next card is sent.
     * Managed at the subscription level to allow for dynamic policy changes.
     */
    dispatchDelaySeconds: integer('dispatch_delay_seconds')
      .notNull()
      .default(7200), // Default: 7200 seconds (2 hours) for basic tier
    
    isActive: boolean('is_active')
      .notNull()
      .default(true),
    
    // Notification Settings
    pushEnabled: boolean('push_enabled')
      .notNull()
      .default(true),
    
    preferredPushTime: time('preferred_push_time'),

    // Learning Statistics (Average progress across all items in the product)
    memoryPercentage: integer('memory_percentage')
      .notNull()
      .default(0),

    // Reference point for n8n workers to calculate the next delivery time
    lastCardSentAt: timestamp('last_card_sent_at', { withTimezone: true }),
    
    subscribedAt: timestamp('subscribed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    
    ...timestamps,
  },
  (table) => [
    // Prevent duplicate subscriptions for the same user and product
    unique('user_product_subscription_unique').on(table.userId, table.learningProductId),
    
    // [Optimization] Indexes for n8n worker to efficiently fetch delivery targets
    index('user_sub_worker_batch_idx').on(table.isActive, table.pushEnabled, table.lastCardSentAt),
    index('user_sub_tier_check_idx').on(table.subscriptionTier, table.lastCardSentAt),
    
    /**
     * Index for Flow 1 to quickly check if the daily goal or delay constraints are met.
     */
    index('user_sub_goal_idx').on(table.userId, table.dailyGoal),

    // General purpose search indexes
    index('user_subscription_user_idx').on(table.userId),
    index('user_subscription_sns_idx').on(table.userSnsConnectionId),
    index('user_subscription_product_idx').on(table.learningProductId),
    
    /**
     * RLS (Row Level Security) Policies
     */
    
    // 1. Standard Users: Can view and manage their own subscriptions
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

    // 2. n8n_worker: Permissive access for batch processing and automated updates
    pgPolicy('user_subscription_worker_manage', {
      for: 'all',
      to: 'n8n_worker',
      as: 'permissive',
      using: sql`true`,
      withCheck: sql`true`,
    }),

    // 3. Admin: Full access via administrative helper functions
    pgPolicy('user_subscription_admin_all', {
      for: 'all',
      to: authenticatedRole,
      using: isAdmin,
    }),
  ],
);

export type UserProductSubscription = typeof userProductSubscription.$inferSelect;
export type NewUserProductSubscription = typeof userProductSubscription.$inferInsert;