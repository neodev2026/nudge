import { pgTable, varchar, pgEnum, primaryKey, integer, foreignKey, bigint, uuid, timestamp, text } from "drizzle-orm/pg-core";
import { tstz } from "~/core/db/helpers.server";
import { SNS_TYPES } from "./constants";
import { CARD_DELIVERY_STATUS } from "../card-delivery/constants";

export const snsTypes = pgEnum("sns_type", SNS_TYPES);
export const liteCardDeliveryStatus = pgEnum("lite_card_delivery_status", CARD_DELIVERY_STATUS);


export const liteProfiles = pgTable("lite_profiles", {
  sns_type: snsTypes("sns_type").notNull(),
  sns_id: varchar("sns_id").notNull(),
  subscription_status: varchar("subscription_status").default("active"),
  ...tstz,
}, (table) => [
  primaryKey({ columns: [table.sns_type, table.sns_id] }),
]);

export const liteContentProgress = pgTable("lite_content_progress", {
  progress_id: bigint("progress_id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),

  // Composite key reference to the user's SNS identity
  sns_type: snsTypes("sns_type").notNull(),
  sns_id: varchar("sns_id").notNull(),

  // Learning domain references
  learning_product_id: uuid("learning_product_id").notNull(),
  current_content_id: uuid("current_content_id"), 
  last_card_id: uuid("last_card_id"),
  
  // Progress tracking fields (Suggested by Senior Dev)
  completed_cards_count: integer("completed_cards_count").default(0).notNull(),
  total_cards_count: integer("total_cards_count").default(0).notNull(),
  
  last_feedback_score: integer("last_feedback_score"),

  // Standard timestamps with timezone support
  ...tstz,
}, (table) => [
  // Composite foreign key referencing lite_profiles
  foreignKey({
    columns: [table.sns_type, table.sns_id],
    foreignColumns: [liteProfiles.sns_type, liteProfiles.sns_id],
  }).onDelete("cascade"),
]);

/**
 * [Delivery Queue] Specialized for Lite users to protect PII (sns_id).
 * Inherits robust retry and lifecycle logic from the standard delivery queue.
 */
export const liteCardDeliveries = pgTable("lite_card_deliveries", {
  delivery_id: uuid("delivery_id").primaryKey().defaultRandom(), // Secure URL token

  // Internal Identity (Hidden from URL)
  sns_type: varchar("sns_type").notNull(), 
  sns_id: varchar("sns_id").notNull(),
  learning_product_id: uuid("learning_product_id").notNull(),
  card_id: uuid("card_id").notNull(), // References learning_card.id
  
  // Sequence Tracking
  previous_delivery_id: uuid("previous_delivery_id"),

  // Status & Lifecycle
  status: liteCardDeliveryStatus("status").notNull().default("pending"),
  scheduled_at: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  sent_at: timestamp("sent_at", { withTimezone: true }),
  opened_at: timestamp("opened_at", { withTimezone: true }),

  // Retry Mechanism (Optimized for worker reliability)
  retry_count: integer("retry_count").notNull().default(0),
  last_error: text("last_error"),
  next_retry_at: timestamp("next_retry_at", { withTimezone: true }),

  ...tstz,
});