import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, jsonb, uuid, integer, index, text, timestamp } from "drizzle-orm/pg-core";
import { authUid, authenticatedRole } from "drizzle-orm/supabase";
import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';
import { learningContent } from '~/features/learning-content/schema';
import { CARD_TYPES, CARD_SCOPES } from "./constants";
import { type StandardizedCardData } from "./types";

/**
 * Enums for card configuration
 */
export const cardType = pgEnum("card_type", CARD_TYPES);
export const cardScope = pgEnum("card_scope", CARD_SCOPES);

/**
 * Master table for learning cards.
 * Stores content data and validation status for the learning engine.
 */
export const learningCard = pgTable(
  "learning_card",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learningContentId: uuid("learning_content_id")
      .notNull()
      .references(() => learningContent.id, { onDelete: "cascade" }),
    
    cardType: cardType("card_type").notNull(),
    cardScope: cardScope("card_scope").notNull().default("shared"),
    
    // JSONB field for standardized content interface
    cardData: jsonb("card_data").$type<StandardizedCardData>().notNull(),
    
    displayOrder: integer("display_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(false), // Needs review before activation

    // Fields for data validation and quality control
    isValid: boolean("is_valid").notNull().default(true),
    errorMessage: text("error_message"),
    
    ...timestamps,
  },
  (table) => [
    index('learning_card_content_idx').on(table.learningContentId),
    index('learning_card_type_idx').on(table.cardType),
    index('learning_card_scope_idx').on(table.cardScope),
    index('learning_card_validation_idx').on(table.isValid).where(sql`${table.isValid} = false`),

    // RLS: Standard users can view active and validated cards
    pgPolicy('learning_card_select_scoped', {
      for: 'select',
      to: authenticatedRole,
      using: sql`
        ${table.isActive} = true AND 
        ${table.isValid} = true AND (
          ${table.cardScope} = 'shared' OR 
          (${table.cardScope} = 'personalized' AND (${table.cardData}->'meta'->>'userId')::uuid = ${authUid})
        )
      `,
    }),
    
    // RLS: Admin has full access to all cards including failed validations
    pgPolicy('learning_card_admin_all', {
      for: 'all',
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: n8n_worker for automation and AI content generation
    pgPolicy('learning_card_n8n_worker_select', {
      for: 'select',
      to: 'n8n_worker',
      using: sql`true`,
    }),
    
    pgPolicy('learning_card_n8n_worker_insert', {
      for: 'insert',
      to: 'n8n_worker',
      withCheck: sql`true`,
    }),    
  ]
);