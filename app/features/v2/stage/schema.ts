import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { tstz } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";
import type { V2CardData } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

// Inline enum values — do NOT import from constants.ts (drizzle-kit ZodError)
export const nv2CardType = pgEnum("nv2_card_type", [
  "title",
  "description",
  "image",
  "etymology",
  "example",
  "option",
  "story",
]);

/**
 * Stage type enum for nv2_stages.
 *
 * welcome        — onboarding stage, delivered once before learning begins
 * learning       — standard vocabulary/content stage
 * quiz_5         — matching quiz at every 5th completion (5, 15, 25, ...)
 * quiz_10        — matching quiz at every 10th completion (10, 20, 30, ...)
 * quiz_daily     — quiz triggered when daily new-stage goal is reached
 * quiz_final     — comprehensive quiz on full product completion
 * congratulations— celebration stage after all stages are mastered
 */
export const nv2StageType = pgEnum("nv2_stage_type", [
  "welcome",
  "learning",
  "quiz_5",
  "quiz_10",
  "quiz_current_session",
  "quiz_current_and_prev_session",
  "quiz_daily",
  "quiz_final",
  "congratulations",
  "sentence_practice",
  "dictation",
  "writing",
  "story",
]);

// ---------------------------------------------------------------------------
// nv2_stages
// ---------------------------------------------------------------------------

/**
 * nv2_stages
 *
 * One row per learning content item (word / phrase / quiz / event).
 * Each stage belongs to a learning product and has an ordered set of cards.
 * stage_number determines delivery sequence within a product (1-based).
 *
 * stage_type controls rendering and delivery logic:
 *   - "learning"        : standard card viewer + self-evaluation
 *   - "welcome"         : service intro cards, no self-evaluation
 *   - "quiz_*"          : matching quiz UI, no card viewer
 *   - "congratulations" : celebration screen, no card viewer
 *
 * The stage page is accessed via a public SNS link (no login required).
 * Active stages are therefore readable without authentication.
 */
export const nv2_stages = pgTable(
  "nv2_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // FK → nv2_learning_products.id
    learning_product_id: uuid("learning_product_id").notNull(),

    // Delivery sequence within the product (1-based).
    // welcome stage uses stage_number = 0 by convention.
    stage_number: integer("stage_number").notNull(),

    // Determines UI rendering and cron delivery logic
    stage_type: nv2StageType("stage_type").notNull().default("learning"),

    // Human-readable label used as page title and SNS link preview text
    title: text("title").notNull(),

    is_active: boolean("is_active").notNull().default(false),

    ...tstz,
  },
  (table) => [
    index("nv2_stages_product_idx").on(table.learning_product_id),
    index("nv2_stages_product_number_idx").on(
      table.learning_product_id,
      table.stage_number
    ),
    index("nv2_stages_type_idx").on(table.stage_type),

    // RLS: Anyone can view active stages (needed for public session link access)
    pgPolicy("nv2_stages_select_active", {
      for: "select",
      to: "public",
      using: sql`${table.is_active} = true`,
    }),

    // RLS: Admin full access
    pgPolicy("nv2_stages_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Service role for cron-triggered API handlers
    pgPolicy("nv2_stages_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),

    // RLS: n8n_worker can insert stages (used by card generation workflow)
    pgPolicy("nv2_stages_n8n_insert", {
      for: "insert",
      to: 'n8n_worker',
      withCheck: sql`true`,
    }),
  ]
);

export type NV2Stage = typeof nv2_stages.$inferSelect;
export type NV2NewStage = typeof nv2_stages.$inferInsert;

// ---------------------------------------------------------------------------
// nv2_cards
// ---------------------------------------------------------------------------

/**
 * nv2_cards
 *
 * Individual learning cards belonging to a stage.
 * Cards are displayed in ascending display_order.
 *
 * Constraints enforced at application level:
 *   - Every "learning" stage must have exactly one "title" card (display_order = 1)
 *   - Every "learning" stage must have exactly one "description" card (display_order = 2)
 *   - Remaining card types are optional and follow in display_order >= 3
 *
 * The stage page is accessed via a public link (no login required),
 * so active cards are readable without authentication.
 */
export const nv2_cards = pgTable(
  "nv2_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    stage_id: uuid("stage_id")
      .notNull()
      .references(() => nv2_stages.id, { onDelete: "cascade" }),

    card_type: nv2CardType("card_type").notNull(),

    // 1 = title (mandatory), 2 = description (mandatory), 3+ = optional cards
    display_order: integer("display_order").notNull(),

    card_data: jsonb("card_data").$type<V2CardData>().notNull(),

    is_active: boolean("is_active").notNull().default(false),

    ...tstz,
  },
  (table) => [
    index("nv2_cards_stage_idx").on(table.stage_id),
    index("nv2_cards_stage_order_idx").on(table.stage_id, table.display_order),
    index("nv2_cards_type_idx").on(table.card_type),

    // RLS: Anyone can view active cards (needed for public session link access)
    pgPolicy("nv2_cards_select_active", {
      for: "select",
      to: "public",
      using: sql`${table.is_active} = true`,
    }),

    // RLS: Admin full access
    pgPolicy("nv2_cards_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Service role
    pgPolicy("nv2_cards_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),

    // RLS: n8n_worker can insert cards (used by card generation workflow)
    pgPolicy("nv2_cards_n8n_insert", {
      for: "insert",
      to: 'n8n_worker',
      withCheck: sql`true`,
    }),
  ]
);

export type NV2Card = typeof nv2_cards.$inferSelect;
export type NV2NewCard = typeof nv2_cards.$inferInsert;
