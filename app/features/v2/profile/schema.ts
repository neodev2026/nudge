import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { tstz } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";
import { DAILY_GOAL_PRESETS, SNS_TYPES } from "~/features/v2/shared/constants";

export const nv2SnsType = pgEnum("nv2_sns_type", SNS_TYPES);

/**
 * nv2_profiles
 *
 * Core identity table for Nudge v2.
 * Users are identified by (sns_type, sns_id) — no auth.users dependency for
 * learning logic. A Supabase Auth user is created via Discord OAuth, and
 * auth_user_id links back to it for RLS and future account upgrades.
 */
export const nv2_profiles = pgTable(
  "nv2_profiles",
  {
    sns_type: nv2SnsType("sns_type").notNull(),
    sns_id: text("sns_id").notNull(),

    // Populated on Discord OAuth sign-in via Supabase Auth
    auth_user_id: text("auth_user_id"),

    // Display info sourced from the SNS provider at connection time
    display_name: text("display_name"),
    avatar_url: text("avatar_url"),

    // Daily learning goal settings
    daily_goal_new: integer("daily_goal_new")
      .notNull()
      .default(DAILY_GOAL_PRESETS.standard.new),
    daily_goal_review: integer("daily_goal_review")
      .notNull()
      .default(DAILY_GOAL_PRESETS.standard.review),

    // Today's counters — reset to 0 at midnight via Supabase Cron
    today_new_count: integer("today_new_count").notNull().default(0),
    today_review_count: integer("today_review_count").notNull().default(0),

    // User's IANA timezone (e.g. "Asia/Seoul", "Europe/Berlin").
    // Used by Cron jobs to calculate local time for each user.
    // Adjustable via personal settings in the future.
    timezone: text("timezone").notNull().default("Asia/Seoul"),

    // Hour of day to send the daily learning DM (0~23, local time).
    // Default: 5 = 05:00 local time. Adjustable via personal settings in the future.
    send_hour: integer("send_hour").notNull().default(5),

    is_active: boolean("is_active").notNull().default(true),

    ...tstz,
  },
  (table) => [
    // Composite PK: platform + platform-scoped user ID
    primaryKey({ columns: [table.sns_type, table.sns_id] }),

    // One Supabase Auth user maps to at most one profile per sns_type
    uniqueIndex("nv2_profiles_auth_user_sns_type_uidx")
      .on(table.auth_user_id, table.sns_type)
      .where(sql`${table.auth_user_id} IS NOT NULL`),

    // RLS: Authenticated users can read their own profile
    pgPolicy("nv2_profiles_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

    // RLS: Authenticated users can insert their own profile.
    // Called during Discord OAuth callback after session is established.
    pgPolicy("nv2_profiles_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

    // RLS: Authenticated users can update their own profile (goal settings etc.)
    pgPolicy("nv2_profiles_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
      withCheck: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

    // RLS: Admin full access
    pgPolicy("nv2_profiles_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Service role for Supabase Cron API calls (counter resets, delivery logic)
    pgPolicy("nv2_profiles_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
  ]
);
