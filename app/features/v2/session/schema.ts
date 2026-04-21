import { sql } from "drizzle-orm";
import {
  bigserial,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uuid,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { tstz, eventTstz } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";
import { nv2_learning_products } from "~/features/v2/products/schema";
import { nv2_stages } from "~/features/v2/stage/schema";

// ---------------------------------------------------------------------------
// Enums — values inlined to avoid drizzle-kit ZodError with constants imports
// ---------------------------------------------------------------------------

export const nv2SessionStatus = pgEnum("nv2_session_status", [
  "pending",
  "in_progress",
  "completed",
]);

export const nv2SessionKind = pgEnum("nv2_session_kind", [
  "new",
  "review",
]);

// ---------------------------------------------------------------------------
// nv2_product_sessions — Product-level session definition (admin)
// ---------------------------------------------------------------------------

/**
 * nv2_product_sessions
 *
 * Defines the session structure for a learning product.
 * Each session is an ordered group of stages (learning + optional quiz)
 * that is delivered to users as a single DM link.
 */
export const nv2_product_sessions = pgTable(
  "nv2_product_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    product_id: uuid("product_id")
      .notNull()
      .references(() => nv2_learning_products.id, { onDelete: "cascade" }),

    // Delivery order within the product (1-based)
    session_number: integer("session_number").notNull(),

    // Optional display label — defaults to "Session {session_number}" in UI
    title: text("title"),

    is_active: boolean("is_active").notNull().default(false),

    ...tstz,
  },
  (table) => [
    index("nv2_product_sessions_product_idx").on(table.product_id),
    index("nv2_product_sessions_product_order_idx").on(
      table.product_id,
      table.session_number
    ),

    pgPolicy("nv2_product_sessions_select_active", {
      for: "select",
      to: "public",
      using: sql`${table.is_active} = true`,
    }),
    pgPolicy("nv2_product_sessions_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),
    pgPolicy("nv2_product_sessions_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
    pgPolicy("nv2_product_sessions_n8n_insert", {
      for: "insert",
      to: "n8n_worker",
      withCheck: sql`true`,
    }),

    // RLS: n8n_worker needs to read all product sessions (including inactive) for workflow queries
    pgPolicy("nv2_product_sessions_n8n_select", {
      for: "select",
      to: "n8n_worker",
      using: sql`true`,
    }),
  ]
);

export type NV2ProductSession = typeof nv2_product_sessions.$inferSelect;
export type NV2NewProductSession = typeof nv2_product_sessions.$inferInsert;

// ---------------------------------------------------------------------------
// nv2_product_session_stages — Session ↔ Stage join table
// ---------------------------------------------------------------------------

export const nv2_product_session_stages = pgTable(
  "nv2_product_session_stages",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),

    product_session_id: uuid("product_session_id")
      .notNull()
      .references(() => nv2_product_sessions.id, { onDelete: "cascade" }),

    stage_id: uuid("stage_id")
      .notNull()
      .references(() => nv2_stages.id, { onDelete: "cascade" }),

    display_order: integer("display_order").notNull(),

    ...tstz,
  },
  (table) => [
    index("nv2_pss_session_idx").on(table.product_session_id),
    index("nv2_pss_stage_idx").on(table.stage_id),
    index("nv2_pss_session_order_idx").on(
      table.product_session_id,
      table.display_order
    ),

    pgPolicy("nv2_product_session_stages_select_public", {
      for: "select",
      to: "public",
      using: sql`true`,
    }),
    pgPolicy("nv2_product_session_stages_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),
    pgPolicy("nv2_product_session_stages_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
    pgPolicy("nv2_product_session_stages_n8n_insert", {
      for: "insert",
      to: "n8n_worker",
      withCheck: sql`true`,
    }),
  ]
);

export type NV2ProductSessionStage =
  typeof nv2_product_session_stages.$inferSelect;
export type NV2NewProductSessionStage =
  typeof nv2_product_session_stages.$inferInsert;

// ---------------------------------------------------------------------------
// nv2_sessions — User-level session (one per user per product_session)
// ---------------------------------------------------------------------------

/**
 * nv2_sessions
 *
 * Tracks a user's progress through a product session.
 * auth_user_id: Supabase auth.users UUID — single identifier for all login methods.
 *
 * Status transitions: pending → in_progress → completed
 */
export const nv2_sessions = pgTable(
  "nv2_sessions",
  {
    // UUID PK — acts as a security token (unguessable link)
    session_id: uuid("session_id").primaryKey().defaultRandom(),

    // User identifier — Supabase auth.users UUID
    auth_user_id: text("auth_user_id").notNull(),

    product_session_id: uuid("product_session_id")
      .notNull()
      .references(() => nv2_product_sessions.id, { onDelete: "cascade" }),

    session_kind: nv2SessionKind("session_kind").notNull().default("new"),

    // For review sessions: which review round (1~4). null for new sessions.
    review_round: integer("review_round"),

    status: nv2SessionStatus("status").notNull().default("pending"),

    // When the DM containing the session link was sent
    dm_sent_at: eventTstz("dm_sent_at"),

    // When the user first opened the session link
    started_at: eventTstz("started_at"),

    // When all stages in the session were completed
    completed_at: eventTstz("completed_at"),

    ...tstz,
  },
  (table) => [
    index("nv2_sessions_user_idx").on(table.auth_user_id),
    index("nv2_sessions_product_session_idx").on(table.product_session_id),
    index("nv2_sessions_status_idx").on(table.status),
    index("nv2_sessions_active_idx")
      .on(table.auth_user_id, table.status)
      .where(sql`${table.status} != 'completed'`),

    // Prevent duplicate active sessions for the same user + product session.
    // new sessions: at most one active (pending/in_progress) per user per product_session
    uniqueIndex("nv2_sessions_user_product_new_uidx")
      .on(table.auth_user_id, table.product_session_id)
      .where(sql`${table.status} != 'completed' AND ${table.session_kind} = 'new'`),
    // review sessions: at most one active per user per product_session per review_round
    uniqueIndex("nv2_sessions_user_product_review_uidx")
      .on(table.auth_user_id, table.product_session_id, table.review_round)
      .where(sql`${table.status} != 'completed' AND ${table.session_kind} = 'review'`),

    // RLS: Users can read their own sessions
    pgPolicy("nv2_sessions_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

    // RLS: Users can insert their own sessions
    pgPolicy("nv2_sessions_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

    // RLS: Users can update their own sessions
    pgPolicy("nv2_sessions_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

    // RLS: Admin full access
    pgPolicy("nv2_sessions_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Public select — session_id UUID acts as a security token
    pgPolicy("nv2_sessions_select_public", {
      for: "select",
      to: "public",
      using: sql`true`,
    }),

    // RLS: Service role for Cron
    pgPolicy("nv2_sessions_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
  ]
);

export type NV2Session = typeof nv2_sessions.$inferSelect;
export type NV2NewSession = typeof nv2_sessions.$inferInsert;
