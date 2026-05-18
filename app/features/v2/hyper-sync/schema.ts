import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { tstz } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";

// ---------------------------------------------------------------------------
// Enums — values inlined to avoid drizzle-kit ZodError with constants imports
// ---------------------------------------------------------------------------

export const hyperSyncResult = pgEnum("hyper_sync_result", ["known", "unknown"]);

// ---------------------------------------------------------------------------
// nv2_hyper_sync_results
//
// Per-card self-evaluation results for Hyper-Sync sessions.
// One row per (user, card, local-date). Upsert on conflict updates result and
// increments known_count when the new result is 'known'.
//
// auth_user_id accepts both Supabase auth.users.id (logged-in users) and
// 'anon:<uuid>' anonymous identifiers (cleared by daily-reset cron after 7 days).
// Anonymous writes go through service_role; RLS select_own only matches
// authenticated rows.
// ---------------------------------------------------------------------------

export const nv2_hyper_sync_results = pgTable(
  "nv2_hyper_sync_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    auth_user_id: text("auth_user_id").notNull(),

    product_id: uuid("product_id").notNull(),

    session_id: uuid("session_id").notNull(),

    // card_id references the title card; example cards are paired in queries.
    card_id: uuid("card_id").notNull(),

    result: hyperSyncResult("result").notNull(),

    // Cumulative count of 'known' verdicts across upserts on the same row.
    known_count: integer("known_count").notNull().default(0),

    // Local date 'YYYY-MM-DD' in user's timezone (KST default).
    session_date: text("session_date").notNull(),

    ...tstz,
  },
  (table) => [
    // Upsert key: same user, same card, same local day → single row.
    uniqueIndex("nv2_hyper_sync_results_user_card_date_uidx").on(
      table.auth_user_id,
      table.card_id,
      table.session_date
    ),

    index("nv2_hyper_sync_results_user_idx").on(table.auth_user_id),
    index("nv2_hyper_sync_results_session_idx").on(table.session_id),

    // RLS: logged-in users read their own rows.
    pgPolicy("nv2_hyper_sync_results_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

    // RLS: service role (admin client) handles all anonymous + cron writes.
    pgPolicy("nv2_hyper_sync_results_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),

    // RLS: admins (by email) have full access for support workflows.
    pgPolicy("nv2_hyper_sync_results_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),
  ]
);

export type NV2HyperSyncResult = typeof nv2_hyper_sync_results.$inferSelect;
export type NV2NewHyperSyncResult = typeof nv2_hyper_sync_results.$inferInsert;
