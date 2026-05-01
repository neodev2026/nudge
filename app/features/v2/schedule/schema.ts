import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { tstz } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";
import { nv2_stages } from "~/features/v2/stage/schema";

// Inline enum values — do NOT import from constants.ts (drizzle-kit ZodError)
export const nv2ScheduleType = pgEnum("nv2_schedule_type", [
  "new",
  "review",
  "cheer",
  "welcome",
  "marathon_nudge",
]);

export const nv2ScheduleStatus = pgEnum("nv2_schedule_status", [
  "pending",
  "sent",
  "failed",
  "opened",
]);

/**
 * nv2_schedules
 *
 * Delivery queue for all outbound SNS messages in Nudge v2.
 * auth_user_id: Supabase auth.users UUID — single identifier for all login methods.
 *
 * Cron jobs (enqueue-daily, enqueue-nudge) INSERT rows here.
 * dispatch reads pending rows and delivers them via Discord DM (or email).
 */
export const nv2_schedules = pgTable(
  "nv2_schedules",
  {
    schedule_id: bigserial("schedule_id", { mode: "bigint" }).primaryKey(),

    // User identifier — Supabase auth.users UUID
    auth_user_id: text("auth_user_id").notNull(),

    schedule_type: nv2ScheduleType("schedule_type").notNull(),

    // Target stage — null for quiz and cheer schedules
    stage_id: uuid("stage_id").references(() => nv2_stages.id, {
      onDelete: "set null",
    }),

    // For review schedules: which round (1~4)
    review_round: integer("review_round"),

    // Full URL delivered to the user via SNS
    delivery_url: text("delivery_url").notNull(),

    // message_body format:
    //   new/review: "product_name|session_title|kind"
    //   cheer:      "cheer:HH|product_name|session_label|message"
    message_body: text("message_body"),

    // Cron picks up rows where scheduled_at <= now() AND status = 'pending'
    scheduled_at: timestamp("scheduled_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),

    sent_at: timestamp("sent_at", {
      withTimezone: true,
      mode: "date",
    }),

    opened_at: timestamp("opened_at", {
      withTimezone: true,
      mode: "date",
    }),

    status: nv2ScheduleStatus("status").notNull().default("pending"),

    error_message: text("error_message"),

    retry_count: integer("retry_count").notNull().default(0),
    max_retries: integer("max_retries").notNull().default(3),

    parent_schedule_id: bigint("parent_schedule_id", {
      mode: "bigint",
    }).references((): any => nv2_schedules.schedule_id, {
      onDelete: "set null",
    }),

    ...tstz,
  },
  (table) => [
    index("nv2_schedules_pending_idx")
      .on(table.scheduled_at, table.status)
      .where(sql`${table.status} = 'pending'`),

    index("nv2_schedules_user_idx").on(table.auth_user_id),
    index("nv2_schedules_stage_idx").on(table.stage_id),
    index("nv2_schedules_type_idx").on(table.schedule_type),

    // RLS: Users can read their own schedules
    pgPolicy("nv2_schedules_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

    pgPolicy("nv2_schedules_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Service role — Cron API handler needs full read/write
    pgPolicy("nv2_schedules_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),

    // RLS: n8n_worker needs to read schedules (dedup check) and insert new ones
    pgPolicy("nv2_schedules_n8n_select", {
      for: "select",
      to: "n8n_worker",
      using: sql`true`,
    }),
    pgPolicy("nv2_schedules_n8n_insert", {
      for: "insert",
      to: "n8n_worker",
      withCheck: sql`true`,
    }),
  ]
);
