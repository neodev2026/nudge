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
import { V2_CARD_TYPES } from "~/features/v2/shared/constants";
import type { V2CardData } from "~/features/v2/shared/types";

export const nv2CardType = pgEnum("nv2_card_type", V2_CARD_TYPES);

/**
 * nv2_stages
 *
 * One row per learning content item (word / phrase).
 * Each stage belongs to a learning product and has an ordered set of cards.
 * stage_number determines delivery sequence within a product (1-based).
 *
 * is_welcome = true marks the onboarding welcome stage, which is always
 * delivered before stage_number ordering begins.
 */
export const nv2_stages = pgTable(
  "nv2_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // References v1 learning_product — v2 reuses existing product definitions
    learning_product_id: uuid("learning_product_id").notNull(),

    // Sequence number within the product (e.g. 1~703 for English B1)
    stage_number: integer("stage_number").notNull(),

    // Human-readable label used as page title and SNS link preview text
    title: text("title").notNull(),

    // Marks the onboarding welcome stage — delivered once before stage 1
    is_welcome: boolean("is_welcome").notNull().default(false),

    is_active: boolean("is_active").notNull().default(false),

    ...tstz,
  },
  (table) => [
    index("nv2_stages_product_idx").on(table.learning_product_id),
    index("nv2_stages_product_number_idx").on(
      table.learning_product_id,
      table.stage_number
    ),

    // RLS: Any authenticated user can view active stages
    pgPolicy("nv2_stages_select_active", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.is_active} = true`,
    }),

    // RLS: Admin full access
    pgPolicy("nv2_stages_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Service role for Cron-triggered API handlers
    pgPolicy("nv2_stages_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
  ]
);

/**
 * nv2_cards
 *
 * Individual learning cards belonging to a stage.
 * Cards are displayed in ascending display_order.
 *
 * Constraints enforced at application level:
 * - Every stage must have exactly one "title" card (display_order = 1)
 * - Every stage must have exactly one "description" card (display_order = 2)
 * - Remaining card types are optional and follow in display_order >= 3
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

    // RLS: Stage pages are link-accessed without login — active cards are public
    pgPolicy("nv2_cards_select_active", {
      for: "select",
      to: authenticatedRole,
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
  ]
);
