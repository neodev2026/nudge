/**
 * nv2_learning_products
 *
 * Product table for Nudge v2. Designed to support any type of learning content,
 * not only language courses. Examples:
 *   - Language learning : category="language", meta={ language:"en", level:"B1" }
 *   - Medical terms     : category="medical",  meta={ domain:"terminology", exam:"USMLE" }
 *   - Certification     : category="exam",     meta={ name:"정보처리기사", year:"2025" }
 *
 * Key design decisions:
 *   - `category` (enum): coarse grouping used for UI routing and filtering
 *   - `meta` (jsonb): flexible key-value store for category-specific attributes
 *   - `language` / `level` enums are intentionally removed — they are stored
 *     inside `meta` for language products so non-language products are not forced
 *     to carry irrelevant columns
 *   - `icon` (text): emoji or icon identifier rendered on product card
 */
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

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Top-level product category.
 * Determines which meta fields are expected and how the UI renders the card.
 * Add new values here as new product types are introduced.
 */
export const nv2ProductCategory = pgEnum("nv2_product_category", [
  "language", // Language learning (English, German, etc.)
  "medical",  // Medical terminology, clinical vocabulary
  "exam",     // Certification / qualification exam prep
  "business", // Business & professional vocabulary
  "general",  // General-purpose / does not fit other categories
]);

// ---------------------------------------------------------------------------
// Meta type helpers (TypeScript only — not stored in DB as a separate type)
// ---------------------------------------------------------------------------

/**
 * Meta shape for category="language" products.
 * language:         ISO 639-1 code  e.g. "en", "de", "ja"
 * level:            CEFR level       e.g. "A1", "B1", "C2"
 * learner_language: ISO 639-1 code  e.g. "ko" (learner's native language)
 * script:           writing system for script products e.g. "hiragana" | "katakana"
 */
export interface LanguageMeta {
  language: string;          // ISO 639-1: "en" | "de" | "ja" | ...
  level: string;             // CEFR:     "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
  learner_language?: string; // ISO 639-1: learner's native/preferred language e.g. "ko"
  script?: 'hiragana' | 'katakana'; // writing system for Japanese script products
}

/**
 * Meta shape for category="medical" products.
 */
export interface MedicalMeta {
  domain?: string; // e.g. "terminology", "anatomy", "pharmacology"
  exam?: string;   // e.g. "USMLE", "KMLE"
}

/**
 * Meta shape for category="exam" products.
 */
export interface ExamMeta {
  exam_name: string;  // e.g. "정보처리기사", "TOEIC", "JLPT"
  year?: string;      // e.g. "2025"
  subject?: string;   // e.g. "소프트웨어 설계"
}

/** Union of all known meta shapes */
export type NV2ProductMeta =
  | LanguageMeta
  | MedicalMeta
  | ExamMeta
  | Record<string, unknown>; // Fallback for future categories

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export const nv2_learning_products = pgTable(
  "nv2_learning_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Coarse product type — drives UI layout and filtering
    category: nv2ProductCategory("category").notNull().default("general"),

    // Human-readable product name shown as the card heading
    // e.g. "English B1", "의학 용어 기초", "정보처리기사 2025"
    name: text("name").notNull(),

    // Short description shown on the product card (1-2 sentences)
    description: text("description"),

    // URL-safe identifier used in /products/:slug routes
    slug: text("slug").notNull().unique(),

    // Emoji or icon key rendered on the product card
    // Language products: flag emoji  e.g. "🇬🇧", "🇩🇪"
    // Medical products:  "🩺"
    // Exam products:     "📝"
    icon: text("icon"),

    // Category-specific attributes stored as flexible key-value pairs.
    // Shape depends on category — see LanguageMeta / MedicalMeta / ExamMeta above.
    meta: jsonb("meta").$type<NV2ProductMeta>().default({}),

    // Denormalized stage count for display — updated by app logic or DB trigger
    total_stages: integer("total_stages").notNull().default(0),

    // Price in KRW. 0 = free product — instant approval without payment.
    price: integer("price").notNull().default(0),

    // Sort order on the product listing page
    display_order: integer("display_order").notNull().default(0),

    is_active: boolean("is_active").notNull().default(false),

    ...tstz,
  },
  (table) => [
    index("nv2_learning_products_active_order_idx").on(
      table.is_active,
      table.display_order
    ),
    index("nv2_learning_products_category_idx").on(table.category),
    index("nv2_learning_products_slug_idx").on(table.slug),

    // RLS: anyone (including anonymous visitors) can view active products
    pgPolicy("nv2_learning_products_select_active", {
      for: "select",
      to: "public",
      using: sql`${table.is_active} = true`,
    }),

    // RLS: admin can view all products including inactive ones
    pgPolicy("nv2_learning_products_select_admin", {
      for: "select",
      to: authenticatedRole,
      using: isAdmin,
    }),

    pgPolicy("nv2_learning_products_insert_admin", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isAdmin,
    }),

    pgPolicy("nv2_learning_products_update_admin", {
      for: "update",
      to: authenticatedRole,
      using: isAdmin,
      withCheck: isAdmin,
    }),

    pgPolicy("nv2_learning_products_delete_admin", {
      for: "delete",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // Service role: Cron jobs may update total_stages
    pgPolicy("nv2_learning_products_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
  ]
);

export type NV2LearningProduct = typeof nv2_learning_products.$inferSelect;
export type NV2NewLearningProduct = typeof nv2_learning_products.$inferInsert;
