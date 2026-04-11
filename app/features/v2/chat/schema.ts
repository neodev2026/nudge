import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { tstz, eventTstz } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";
import { NV2_CHAT_ROLES, NV2_CHAT_MESSAGE_TYPES } from "~/features/v2/shared/constants";
import { nv2_sessions } from "~/features/v2/session/schema";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const nv2ChatRole = pgEnum("nv2_chat_role", NV2_CHAT_ROLES);

export const nv2ChatMessageType = pgEnum(
  "nv2_chat_message_type",
  NV2_CHAT_MESSAGE_TYPES
);

// ---------------------------------------------------------------------------
// nv2_chat_turns — Chat message history per session
// ---------------------------------------------------------------------------

/**
 * nv2_chat_turns
 *
 * Stores every message exchanged between the user and Leni within a session.
 * Both user and Leni messages are stored here for full conversation history.
 *
 * Retention policy:
 *   Rows older than CHAT_TURN_RETENTION_DAYS (default 90) are deleted nightly
 *   by the daily-reset cron job.
 *
 * content JSONB shape per message_type:
 *   text             : { text: string }
 *   card             : { card_id: string }
 *   quiz             : { stage_id: string }
 *   writing_prompt   : { text: string }
 *   dictation        : { card_id: string, audio_text: string }
 *   feedback         : { text: string, corrected?: string }
 */
export const nv2_chat_turns = pgTable(
  "nv2_chat_turns",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Auth user ID — allows future email-signup users without Discord
    auth_user_id: text("auth_user_id").notNull(),

    // Session reference — nullable to support future chat outside a session
    session_id: uuid("session_id").references(() => nv2_sessions.session_id, {
      onDelete: "set null",
    }),

    role: nv2ChatRole("role").notNull(),

    message_type: nv2ChatMessageType("message_type").notNull().default("text"),

    // Flexible payload — shape varies by message_type (see JSDoc above)
    content: text("content").notNull(), // stored as JSON string

    ...tstz,
  },
  (table) => [
    index("nv2_chat_turns_user_idx").on(table.auth_user_id),
    index("nv2_chat_turns_session_idx").on(table.session_id),
    index("nv2_chat_turns_created_idx").on(table.created_at),

    // RLS: Users can read their own turns
    pgPolicy("nv2_chat_turns_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

    // RLS: Users can insert their own turns
    pgPolicy("nv2_chat_turns_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

    // RLS: Admin full access
    pgPolicy("nv2_chat_turns_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Service role (cron retention cleanup)
    pgPolicy("nv2_chat_turns_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
  ]
);

export type NV2ChatTurn = typeof nv2_chat_turns.$inferSelect;
export type NV2NewChatTurn = typeof nv2_chat_turns.$inferInsert;

// ---------------------------------------------------------------------------
// nv2_turn_balance — Per-user AI chat turn quota
// ---------------------------------------------------------------------------

/**
 * nv2_turn_balance
 *
 * Tracks each user's remaining AI chat turns.
 * Two independent buckets:
 *   subscription_turns : from monthly subscription (resets at subscription_reset_at)
 *   charged_turns      : from one-time top-up purchases (never expire)
 *
 * Deduction order: subscription_turns first, then charged_turns.
 * When both reach 0, the chat API returns a payment prompt.
 *
 * This table intentionally has no payment logic — it is populated manually
 * by admins (via admin UI) or by the future payment webhook.
 */
export const nv2_turn_balance = pgTable(
  "nv2_turn_balance",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Auth user ID — one row per user
    auth_user_id: text("auth_user_id").notNull().unique(),

    // Monthly subscription turns (reset each billing cycle)
    subscription_turns: integer("subscription_turns").notNull().default(0),

    // When subscription_turns resets (null = no active subscription)
    subscription_reset_at: eventTstz("subscription_reset_at"),

    // One-time charged turns (never expire)
    charged_turns: integer("charged_turns").notNull().default(0),

    ...tstz,
  },
  (table) => [
    index("nv2_turn_balance_user_idx").on(table.auth_user_id),

    // RLS: Users can read their own balance
    pgPolicy("nv2_turn_balance_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
    }),

    // RLS: Admin full access (manual top-up via admin UI)
    pgPolicy("nv2_turn_balance_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Service role (deduction by chat API action)
    pgPolicy("nv2_turn_balance_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
  ]
);

export type NV2TurnBalance = typeof nv2_turn_balance.$inferSelect;
export type NV2NewTurnBalance = typeof nv2_turn_balance.$inferInsert;
