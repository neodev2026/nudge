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
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { tstz, eventTstz, snsIdentity } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";
import { V2_SESSION_STATUSES, V2_SESSION_KINDS } from "~/features/v2/shared/constants";
import { nv2_learning_products } from "~/features/v2/products/schema";
import { nv2_stages } from "~/features/v2/stage/schema";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const nv2SessionStatus = pgEnum(
  "nv2_session_status",
  V2_SESSION_STATUSES
);

/**
 * Session kind — distinguishes first-time learning from spaced-repetition review.
 */
export const nv2SessionKind = pgEnum(
  "nv2_session_kind",
  V2_SESSION_KINDS
);

// ---------------------------------------------------------------------------
// nv2_product_sessions — Product-level session definition (admin)
// ---------------------------------------------------------------------------

/**
 * nv2_product_sessions
 *
 * Defines the session structure for a learning product.
 * Each session is an ordered group of stages (learning + optional quiz)
 * that is delivered to users as a single DM link.
 *
 * Admins configure sessions via the admin UI:
 *   - Drag stages into sessions
 *   - Place quiz stages at desired positions
 *   - Reorder sessions within a product
 *
 * Default generation rule (applied when a product is first published):
 *   Every 5 learning stages → append quiz_5 stage
 *   Every 10 learning stages → append quiz_10 stage instead of quiz_5
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

    // RLS: Anyone can view active product sessions (needed for session page)
    pgPolicy("nv2_product_sessions_select_active", {
      for: "select",
      to: "public",
      using: sql`${table.is_active} = true`,
    }),

    // RLS: Admin full access
    pgPolicy("nv2_product_sessions_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Service role
    pgPolicy("nv2_product_sessions_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),

    // RLS: n8n_worker can insert product sessions (used by card generation workflow)
    pgPolicy("nv2_product_sessions_n8n_insert", {
      for: "insert",
      to: 'n8n_worker',
      withCheck: sql`true`,
    }),
  ]
);

export type NV2ProductSession = typeof nv2_product_sessions.$inferSelect;
export type NV2NewProductSession = typeof nv2_product_sessions.$inferInsert;

// ---------------------------------------------------------------------------
// nv2_product_session_stages — Session ↔ Stage join table
// ---------------------------------------------------------------------------

/**
 * nv2_product_session_stages
 *
 * Many-to-many join between nv2_product_sessions and nv2_stages.
 * display_order determines the order stages are shown within a session.
 *
 * A stage can appear in at most one session per product (enforced by unique index).
 */
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

    // Order within the session (1-based)
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

    // RLS: Public read (session page needs stage list without auth)
    pgPolicy("nv2_product_session_stages_select_public", {
      for: "select",
      to: "public",
      using: sql`true`,
    }),

    // RLS: Admin full access
    pgPolicy("nv2_product_session_stages_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Service role
    pgPolicy("nv2_product_session_stages_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),

    // RLS: n8n_worker can insert session stages (used by card generation workflow)
    pgPolicy("nv2_product_session_stages_n8n_insert", {
      for: "insert",
      to: 'n8n_worker',
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
 * Created when a user starts a session (via "학습 시작" button or cron).
 *
 * Status transitions:
 *   pending → in_progress → completed
 *
 * One user can have at most one non-completed session per product at a time.
 * (Enforced at application level by start-learning.tsx)
 */
export const nv2_sessions = pgTable(
  "nv2_sessions",
  {
    // UUID PK — acts as a security token (unguessable link)
    session_id: uuid("session_id").primaryKey().defaultRandom(),

    // Profile reference — composite FK to nv2_profiles(sns_type, sns_id)
    ...snsIdentity,

    product_session_id: uuid("product_session_id")
      .notNull()
      .references(() => nv2_product_sessions.id, { onDelete: "cascade" }),

    // Distinguishes new learning from spaced-repetition review
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
    index("nv2_sessions_profile_idx").on(table.sns_type, table.sns_id),
    index("nv2_sessions_product_session_idx").on(table.product_session_id),
    index("nv2_sessions_status_idx").on(table.status),

    // Cron query: find pending/in_progress sessions for nudge DMs
    index("nv2_sessions_active_idx")
      .on(table.sns_type, table.sns_id, table.status)
      .where(sql`${table.status} != 'completed'`),

    // RLS: Users can read their own sessions
    pgPolicy("nv2_sessions_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = ${table.sns_type}::text
            AND p.sns_id         = ${table.sns_id}
            AND p.auth_user_id   = auth.uid()::text
        )
      `,
    }),

    // RLS: Users can insert their own sessions
    pgPolicy("nv2_sessions_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = ${table.sns_type}::text
            AND p.sns_id         = ${table.sns_id}
            AND p.auth_user_id   = auth.uid()::text
        )
      `,
    }),

    // RLS: Users can update their own sessions
    pgPolicy("nv2_sessions_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = ${table.sns_type}::text
            AND p.sns_id         = ${table.sns_id}
            AND p.auth_user_id   = auth.uid()::text
        )
      `,
    }),

    // RLS: Admin full access
    pgPolicy("nv2_sessions_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Public select — session_id UUID acts as a security token
    // Anyone with the link can view the session (needed for DM link access)
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
