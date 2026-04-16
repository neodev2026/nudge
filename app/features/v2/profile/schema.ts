import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { tstz } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";
import { DAILY_GOAL_PRESETS } from "~/features/v2/shared/constants";

/**
 * nv2_profiles
 *
 * Core identity table for Nudge v2.
 * Primary key: auth_user_id (Supabase Auth user UUID).
 *
 * SNS delivery channels:
 *   discord_id — set when user connects Discord OAuth; used for Bot DM delivery
 *   email      — set on Google/email sign-up; used for email delivery fallback
 *
 * Notification opt-out:
 *   discord_dm_unsubscribed — user has opted out of Discord DMs
 *   email_unsubscribed      — user has opted out of email notifications
 *
 * DM dispatch logic (enforced at application level):
 *   discord_id present + discord_dm_unsubscribed = false → Discord Bot DM
 *   discord_id absent  + email present + email_unsubscribed = false → Resend email
 *   otherwise → skip
 */
export const nv2_profiles = pgTable(
  "nv2_profiles",
  {
    // Primary key — Supabase Auth user UUID
    auth_user_id: text("auth_user_id").primaryKey(),

    // Discord OAuth identity — populated on Discord sign-in
    // Used as the recipient ID for Discord Bot DM delivery
    discord_id: text("discord_id"),

    // Email address — populated on Google/email sign-up
    // Used for Resend email delivery when discord_id is absent
    email: text("email"),

    // Notification opt-out flags
    discord_dm_unsubscribed: boolean("discord_dm_unsubscribed")
      .notNull()
      .default(false),
    email_unsubscribed: boolean("email_unsubscribed")
      .notNull()
      .default(false),

    // Display info sourced from the OAuth provider at sign-in
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
    // Captured from the browser on first sign-in.
    timezone: text("timezone").notNull().default("Asia/Seoul"),

    // Hour of day to send the daily learning DM (0~23, local time).
    send_hour: integer("send_hour").notNull().default(5),

    is_active: boolean("is_active").notNull().default(true),

    ...tstz,
  },
  (table) => [
    // One profile per Discord account
    uniqueIndex("nv2_profiles_discord_id_uidx")
      .on(table.discord_id)
      .where(sql`${table.discord_id} IS NOT NULL`),

    // One profile per email address
    uniqueIndex("nv2_profiles_email_uidx")
      .on(table.email)
      .where(sql`${table.email} IS NOT NULL`),

    // Fast lookup for Cron (DM dispatch iterates all active profiles)
    index("nv2_profiles_active_idx").on(table.is_active),

    // RLS: authenticated users can read/write their own profile
    pgPolicy("nv2_profiles_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

    pgPolicy("nv2_profiles_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

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

    // RLS: Service role for Cron and server-side operations
    pgPolicy("nv2_profiles_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
  ]
);

export type NV2Profile = typeof nv2_profiles.$inferSelect;
export type NV2NewProfile = typeof nv2_profiles.$inferInsert;
