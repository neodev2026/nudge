/**
 * Card Delivery Feature Schema
 * Optimized for high-performance retrieval and robust error recovery.
 */
import { sql } from "drizzle-orm";
import { 
  pgTable, 
  uuid, 
  timestamp, 
  text, 
  integer, 
  pgEnum, 
  index, 
  pgPolicy 
} from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { learningCard } from "~/features/learning-card/schema";
import { userSNSConnection } from "~/features/user-sns-connection/schema";
import { CARD_DELIVERY_STATUS } from "./constants";

/**
 * PostgreSQL Enum for Delivery Status
 */
export const cardDeliveryStatus = pgEnum("card_delivery_status", CARD_DELIVERY_STATUS);

/**
 * Card Delivery Queue Table
 * Tracks the lifecycle and retry logic of every nudge sent to users.
 */
export const cardDeliveryQueue = pgTable(
  "card_delivery_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),

    connectionId: uuid("connection_id")
      .notNull()
      .references(() => userSNSConnection.id, { onDelete: "cascade" }),

    learningCardId: uuid("learning_card_id")
      .notNull()
      .references(() => learningCard.id, { onDelete: "cascade" }),

    previousDeliveryId: uuid("previous_delivery_id"),

    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    
    status: cardDeliveryStatus("status").notNull().default("pending"),

    // Retry Mechanism Fields
    retryCount: integer("retry_count").notNull().default(0),
    lastError: text("last_error"),
    
    /**
     * [New] The calculated time for the next retry attempt.
     * Used for implementing Exponential Backoff.
     */
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    
    sentAt: timestamp("sent_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),

    ...timestamps,
  },
  (table) => [
    // PRIMARY WORKER INDEX: Fetches initial pending items
    index("card_delivery_worker_batch_idx").on(table.status, table.scheduledAt),
    
    /**
     * [New] RETRY WORKER INDEX: Optimized for fetching items ready for retry.
     * Helps the secondary n8n flow find 'retry_required' items whose nextRetryAt is in the past.
     */
    index("card_delivery_retry_worker_idx").on(table.status, table.nextRetryAt),

    index("card_delivery_user_history_idx").on(table.userId, table.scheduledAt),
    index("card_delivery_engagement_idx").on(table.status, table.openedAt),

    // RLS POLICIES
    pgPolicy("card_delivery_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    pgPolicy("card_delivery_worker_manage", {
      for: "all",
      to: "n8n_worker",
      as: "permissive",
      using: sql`true`,
      withCheck: sql`true`,
    }),

    pgPolicy("card_delivery_insert_own", {
      for: "insert",
      to: authenticatedRole,
      as: "permissive",
      withCheck: sql`${table.userId} = ${authUid}`, 
    }),

    pgPolicy("card_delivery_select_own", {
      for: "select",
      to: authenticatedRole,
      as: "permissive",
      using: sql`${table.userId} = ${authUid}`, 
    }),
  ]
);

export type CardDeliveryQueue = typeof cardDeliveryQueue.$inferSelect;
export type NewCardDeliveryQueue = typeof cardDeliveryQueue.$inferInsert;