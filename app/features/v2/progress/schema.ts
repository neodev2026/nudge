import { sql } from "drizzle-orm";
import {
  bigserial,
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
import { tstz } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";
import { REVIEW_STATUSES, SNS_TYPES } from "~/features/v2/shared/constants";
import { nv2_stages } from "~/features/v2/stage/schema";

export const nv2ReviewStatus = pgEnum("nv2_review_status", REVIEW_STATUSES);

/**
 * nv2_stage_progress
 *
 * Tracks one user's journey through one stage.
 * A row is created when the stage link is first opened.
 *
 * Behavioural rules:
 * - retry_count     : incremented each time "다시 보기" is tapped
 * - completed_at    : set on first "암기 완료" tap (immutable after that)
 * - review_status   : drives the forgetting-curve schedule (none → r1~r4 → mastered)
 * - review_round    : the round currently pending delivery (1~4), null when idle
 * - next_review_at  : when the Cron job should dispatch the next review link
 *
 * Interval halving rule (enforced at application level):
 * If retry_count >= 3 at the time of completion, the next review interval
 * is halved. E.g. round 3 normally fires at +7 days → fires at +3 days instead.
 */
export const nv2_stage_progress = pgTable(
  "nv2_stage_progress",
  {
    progress_id: bigserial("progress_id", { mode: "bigint" }).primaryKey(),

    // Profile reference — composite FK to nv2_profiles(sns_type, sns_id)
    sns_type: text("sns_type")
      .notNull()
      .$type<(typeof SNS_TYPES)[number]>(),
    sns_id: text("sns_id").notNull(),

    stage_id: uuid("stage_id")
      .notNull()
      .references(() => nv2_stages.id, { onDelete: "cascade" }),

    // Number of times "다시 보기" was tapped before final "암기 완료"
    retry_count: integer("retry_count").notNull().default(0),

    // Set on first "암기 완료" — null until then
    completed_at: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Spaced-repetition state machine
    review_status: nv2ReviewStatus("review_status").notNull().default("none"),

    // Current review round awaiting delivery (1~4), null if no review pending
    review_round: integer("review_round"),

    // When the next review stage link should be dispatched
    next_review_at: timestamp("next_review_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Timestamp of the most recent review completion (used to compute next interval)
    last_review_completed_at: timestamp("last_review_completed_at", {
      withTimezone: true,
      mode: "date",
    }),

    ...tstz,
  },
  (table) => [
    index("nv2_stage_progress_profile_idx").on(table.sns_type, table.sns_id),
    index("nv2_stage_progress_stage_idx").on(table.stage_id),

    // Cron query: find rows due for review dispatch
    index("nv2_stage_progress_review_idx")
      .on(table.next_review_at)
      .where(sql`${table.next_review_at} IS NOT NULL`),

    // Unique constraint — one progress row per (user, stage)
    uniqueIndex("nv2_stage_progress_user_stage_uidx").on(
      table.sns_type,
      table.sns_id,
      table.stage_id
    ),

    // RLS: Users can read/write their own progress rows
    pgPolicy("nv2_stage_progress_select_own", {
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

    pgPolicy("nv2_stage_progress_insert_own", {
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

    pgPolicy("nv2_stage_progress_update_own", {
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
    pgPolicy("nv2_stage_progress_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Service role for Cron API calls
    pgPolicy("nv2_stage_progress_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
  ]
);
