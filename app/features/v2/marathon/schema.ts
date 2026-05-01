import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { eventTstz, tstz } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";

// ---------------------------------------------------------------------------
// Enums — values inlined to avoid drizzle-kit ZodError with constants imports
// ---------------------------------------------------------------------------

export const nv2MarathonRunStatus = pgEnum("nv2_marathon_run_status", [
  "in_progress",
  "completed",
]);

// ---------------------------------------------------------------------------
// nv2_marathon_runs — one row per marathon attempt per user per product
// ---------------------------------------------------------------------------

export const nv2_marathon_runs = pgTable(
  "nv2_marathon_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    auth_user_id: text("auth_user_id").notNull(),

    product_id: uuid("product_id").notNull(),

    // 1-based: how many times this user has completed this product
    run_number: integer("run_number").notNull(),

    status: nv2MarathonRunStatus("status").notNull().default("in_progress"),

    // Final quiz score — set on completion only
    score: integer("score"),
    total_questions: integer("total_questions"),

    // 0-based index of the next stage to start (resume position)
    last_stage_index: integer("last_stage_index").notNull().default(0),

    // Global card cursor for nudge DMs — 0-based flat index across all stages
    nudge_card_cursor: integer("nudge_card_cursor").notNull().default(0),

    // Total time from started_at to completed_at in seconds
    elapsed_seconds: integer("elapsed_seconds"),

    started_at: timestamp("started_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    completed_at: eventTstz("completed_at"),

    ...tstz,
  },
  (table) => [
    index("nv2_marathon_runs_user_idx").on(table.auth_user_id),
    index("nv2_marathon_runs_product_idx").on(table.product_id),
    index("nv2_marathon_runs_user_product_idx").on(
      table.auth_user_id,
      table.product_id
    ),
    index("nv2_marathon_runs_status_idx").on(table.auth_user_id, table.status),

    pgPolicy("nv2_marathon_runs_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
    }),
    pgPolicy("nv2_marathon_runs_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.auth_user_id} = auth.uid()::text`,
    }),
    pgPolicy("nv2_marathon_runs_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
    }),
    pgPolicy("nv2_marathon_runs_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
    pgPolicy("nv2_marathon_runs_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),
  ]
);

export type NV2MarathonRun = typeof nv2_marathon_runs.$inferSelect;
export type NV2NewMarathonRun = typeof nv2_marathon_runs.$inferInsert;

// ---------------------------------------------------------------------------
// nv2_marathon_answers — final quiz answers only (mini/review quiz not stored)
// ---------------------------------------------------------------------------

export const nv2_marathon_answers = pgTable(
  "nv2_marathon_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    run_id: uuid("run_id").notNull(),

    // stage_id identifies the word (learning stage) this question was about
    stage_id: uuid("stage_id").notNull(),

    // word_to_meaning | meaning_to_word
    question_direction: text("question_direction").notNull(),

    is_correct: boolean("is_correct").notNull(),

    answered_at: timestamp("answered_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),

    ...tstz,
  },
  (table) => [
    index("nv2_marathon_answers_run_idx").on(table.run_id),

    // One answer per stage per run (final quiz has one question per stage)
    uniqueIndex("nv2_marathon_answers_run_stage_uidx").on(
      table.run_id,
      table.stage_id
    ),

    pgPolicy("nv2_marathon_answers_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
    pgPolicy("nv2_marathon_answers_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),
  ]
);

export type NV2MarathonAnswer = typeof nv2_marathon_answers.$inferSelect;
export type NV2NewMarathonAnswer = typeof nv2_marathon_answers.$inferInsert;
