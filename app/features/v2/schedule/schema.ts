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
import {
  SCHEDULE_STATUSES,
  SNS_TYPES,
  V2_SCHEDULE_TYPES,
} from "~/features/v2/shared/constants";
import { nv2_stages } from "~/features/v2/stage/schema";

export const nv2ScheduleType = pgEnum("nv2_schedule_type", V2_SCHEDULE_TYPES);
export const nv2ScheduleStatus = pgEnum("nv2_schedule_status", SCHEDULE_STATUSES);

/**
 * nv2_schedules
 *
 * Delivery queue for all outbound SNS messages in Nudge v2.
 * Supabase Cron calls the service API at a fixed interval (e.g. every minute).
 * The API queries rows WHERE status = 'pending' AND scheduled_at <= now()
 * and dispatches them to the appropriate SNS channel.
 *
 * Schedule type rules (enforced at application level):
 * - new     : created immediately after the previous stage is completed
 *             and today_new_count < daily_goal_new
 * - review  : created by review scheduling logic after each stage completion
 * - quiz    : created after the 5th / 10th cumulative new-stage completion
 * - cheer   : created when a pending new/review stage is still incomplete
 *             at the next scheduled send time; max 1 cheer per stage per day
 * - welcome : created once when the user first connects their SNS account
 *
 * stage_id is NULL for quiz and cheer types that do not target a single stage.
 * parent_schedule_id links a cheer back to the original new/review schedule
 * it was generated for, enabling the "1 cheer per stage per day" guard.
 */
export const nv2_schedules = pgTable(
  "nv2_schedules",
  {
    schedule_id: bigserial("schedule_id", { mode: "bigint" }).primaryKey(),

    sns_type: text("sns_type")
      .notNull()
      .$type<(typeof SNS_TYPES)[number]>(),
    sns_id: text("sns_id").notNull(),

    schedule_type: nv2ScheduleType("schedule_type").notNull(),

    // Target stage — null for quiz and cheer schedules
    stage_id: uuid("stage_id").references(() => nv2_stages.id, {
      onDelete: "set null",
    }),

    // For review schedules: which round (1~4)
    review_round: integer("review_round"),

    // Full URL delivered to the user via SNS
    delivery_url: text("delivery_url").notNull(),

    // Custom message body; null = use the default template for this schedule_type
    message_body: text("message_body"),

    // Cron picks up rows where scheduled_at <= now() AND status = 'pending'
    scheduled_at: timestamp("scheduled_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),

    // Set when the message is successfully dispatched
    sent_at: timestamp("sent_at", {
      withTimezone: true,
      mode: "date",
    }),

    // Set when the user taps the delivered link (optional tracking via redirect)
    opened_at: timestamp("opened_at", {
      withTimezone: true,
      mode: "date",
    }),

    status: nv2ScheduleStatus("status").notNull().default("pending"),

    // Error detail from the SNS provider on failure
    error_message: text("error_message"),

    // Retry tracking — Cron increments retry_count on each failed attempt
    retry_count: integer("retry_count").notNull().default(0),
    max_retries: integer("max_retries").notNull().default(3),

    // Links a cheer schedule to the original new/review schedule it was generated for
    parent_schedule_id: bigint("parent_schedule_id", {
      mode: "bigint",
    }).references((): any => nv2_schedules.schedule_id, {
      onDelete: "set null",
    }),

    ...tstz,
  },
  (table) => [
    // Primary Cron query index
    index("nv2_schedules_pending_idx")
      .on(table.scheduled_at, table.status)
      .where(sql`${table.status} = 'pending'`),

    index("nv2_schedules_profile_idx").on(table.sns_type, table.sns_id),
    index("nv2_schedules_stage_idx").on(table.stage_id),
    index("nv2_schedules_type_idx").on(table.schedule_type),

    // RLS: Users can read their own schedules (e.g. for a delivery history UI)
    pgPolicy("nv2_schedules_select_own", {
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

    // RLS: Admin full access
    pgPolicy("nv2_schedules_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Service role — Cron API handler needs full read/write on this table
    pgPolicy("nv2_schedules_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
  ]
);
