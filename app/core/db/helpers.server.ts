/**
 * Database Helper Functions
 *
 * This file provides utility functions and objects for database schema definitions.
 * These helpers ensure consistent patterns across all database tables.
 */
import { bigint, bigserial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Standard timestamp columns for database tables
 *
 * Adds created_at and updated_at columns to any table where this object is spread.
 * Both columns are automatically set to the current timestamp when records are created,
 * and updated_at is refreshed when records are updated.
 */
export const timestamps = {
  updated_at: timestamp().defaultNow().notNull(),
  created_at: timestamp().defaultNow().notNull(),
};

export const tstz = {
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
};

/**
 * Creates an auto-incrementing primary key column
 *
 * @param name - The name of the primary key column (e.g., "user_id", "payment_id")
 * @returns An object with the named column configured as a bigint primary key with IDENTITY
 *
 * This function creates a PostgreSQL IDENTITY column that auto-increments,
 * which is ideal for primary keys that don't need to be UUIDs.
 */
export function makeIdentityColumn(name: string) {
  return {
    [name]: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  };
}

// ─────────────────────────────────────────────────────────────
// v2 additions
// ─────────────────────────────────────────────────────────────

/**
 * Creates a bigserial primary key column for v2 tables.
 *
 * Convention: primary key name = table name suffix + "_id"
 * e.g. nv2_stage_progress → progress_id
 *      nv2_quiz_results   → quiz_result_id
 *      nv2_schedules      → schedule_id
 *
 * @param name - The primary key column name (snake_case, e.g. "progress_id")
 *
 * Usage:
 *   ...makeSerialPk("progress_id"),
 */
export function makeSerialPk(name: string) {
  return {
    [name]: bigserial(name, { mode: "bigint" }).primaryKey(),
  };
}

/**
 * User identity column for v2 tables.
 *
 * All v2 tables scoped to a user carry auth_user_id as a foreign key
 * referencing nv2_profiles(auth_user_id).
 * Replaces the previous composite (sns_type, sns_id) pattern.
 *
 * Usage:
 *   ...userIdentity,
 */
export const userIdentity = {
  auth_user_id: text("auth_user_id").notNull(),
};

/**
 * @deprecated Use userIdentity instead.
 * Kept temporarily for reference during migration.
 */
export const snsIdentity = {
  sns_type: text("sns_type").notNull(),
  sns_id: text("sns_id").notNull(),
};

/**
 * Optional timestamp column with timezone for event tracking.
 *
 * Used for nullable event timestamps (completed_at, sent_at, opened_at, etc.)
 * that are set by application logic rather than DB defaults.
 *
 * @param name - Column name in snake_case
 *
 * Usage:
 *   completed_at: eventTstz("completed_at"),
 */
export function eventTstz(name: string) {
  return timestamp(name, { withTimezone: true, mode: "date" });
}
