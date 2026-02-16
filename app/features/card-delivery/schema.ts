/**
 * Card Delivery Feature Schema
 * * Manages the queue and history of learning cards sent to users.
 * Optimized for high-performance retrieval by n8n workers.
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
 * Tracks the lifecycle of every nudge sent to users.
 */
export const cardDeliveryQueue = pgTable(
  "card_delivery_queue",
  {
    // Primary Key
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Foreign Key: Recipient user
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),

    // Foreign Key: Targeted SNS connection (Discord, etc.)
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => userSNSConnection.id, { onDelete: "cascade" }),

    // Foreign Key: The specific learning card to be delivered
    learningCardId: uuid("learning_card_id")
      .notNull()
      .references(() => learningCard.id, { onDelete: "cascade" }),

    // Link to previous delivery for learning chain tracking
    previousDeliveryId: uuid("previous_delivery_id"),

    // Scheduled time for delivery (UTC)
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    
    // Current delivery lifecycle status
    status: cardDeliveryStatus("status").notNull().default("pending"),

    // Retry mechanism fields for worker reliability
    retryCount: integer("retry_count").notNull().default(0),
    lastError: text("last_error"),
    
    // Timestamps for engagement tracking
    sentAt: timestamp("sent_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),

    // Standard created_at and updated_at timestamps
    ...timestamps,
  },
  (table) => [
    // ============================================
    // INDEXES
    // ============================================
    
    // Primary index for n8n worker to fetch pending nudges
    index("card_delivery_worker_batch_idx").on(table.status, table.scheduledAt),
    
    // Index for user-specific delivery history
    index("card_delivery_user_history_idx").on(table.userId, table.scheduledAt),

    // Index for tracking engagement metrics
    index("card_delivery_engagement_idx").on(table.status, table.openedAt),

    // ============================================
    // RLS POLICIES
    // ============================================

    /**
     * Policy: Admin - Full access for monitoring and manual intervention
     */
    pgPolicy("card_delivery_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    /**
     * Policy: n8n_worker - Optimized for queue management and status updates
     */
    pgPolicy("card_delivery_worker_manage", {
      for: "all",
      to: "n8n_worker",
      as: "permissive",
      using: sql`true`,
      withCheck: sql`true`,
    }),

    /**
     * Policy: Authenticated - Allow users to insert their own delivery records.
     * Required for the subscription initialization process.
     */
    pgPolicy("card_delivery_insert_own", {
      for: "insert",
      to: authenticatedRole,
      as: "permissive",
      withCheck: sql`${table.userId} = ${authUid}`, //
    }),

    /**
     * Policy: Authenticated - Allow users to view their own delivery history.
     */
    pgPolicy("card_delivery_select_own", {
      for: "select",
      to: authenticatedRole,
      as: "permissive",
      using: sql`${table.userId} = ${authUid}`, //
    }),
  ]
);

// Type inference for select and insert operations
export type CardDeliveryQueue = typeof cardDeliveryQueue.$inferSelect;
export type NewCardDeliveryQueue = typeof cardDeliveryQueue.$inferInsert;