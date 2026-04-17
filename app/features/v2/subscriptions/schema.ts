import { sql } from "drizzle-orm";
import {
  index,
  uniqueIndex,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { tstz, eventTstz } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";
import { nv2_learning_products } from "~/features/v2/products/schema";

// Inline enum values — do NOT import from constants.ts (drizzle-kit ZodError)
export const nv2LinkAccessType = pgEnum("nv2_link_access_type", [
  "public",
  "members_only",
]);

/**
 * Subscription source: how the subscription was created.
 *   paid  — payment completed
 *   free  — zero-price product, instant approval (no payment required)
 *   admin — manually granted by admin
 */
export const nv2SubscriptionSource = pgEnum("nv2_subscription_source", [
  "paid",
  "free",
  "admin",
]);

/**
 * nv2_subscriptions
 *
 * Tracks which learning products a user has subscribed to.
 * auth_user_id: Supabase auth.users UUID — single identifier for all login methods.
 *
 * link_access = 'public' (default):
 *   Session links work without login.
 *
 * link_access = 'members_only':
 *   Session link requires login.
 */
export const nv2_subscriptions = pgTable(
  "nv2_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    auth_user_id: text("auth_user_id").notNull(),
    product_id: uuid("product_id")
      .notNull()
      .references(() => nv2_learning_products.id, { onDelete: "cascade" }),
    link_access: nv2LinkAccessType("link_access").notNull().default("public"),
    is_active: boolean("is_active").notNull().default(true),
    source: nv2SubscriptionSource("source").notNull().default("free"),
    started_at: eventTstz("started_at"),
    ...tstz,
  },
  (table) => [
    uniqueIndex("nv2_subscriptions_user_product_idx").on(
      table.auth_user_id, table.product_id
    ),
    index("nv2_subscriptions_product_idx").on(table.product_id),
    pgPolicy("nv2_subscriptions_select_own", {
      for: "select", to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
    }),
    pgPolicy("nv2_subscriptions_insert_own", {
      for: "insert", to: authenticatedRole,
      withCheck: sql`${table.auth_user_id} = auth.uid()::text`,
    }),
    pgPolicy("nv2_subscriptions_update_own", {
      for: "update", to: authenticatedRole,
      using: sql`${table.auth_user_id} = auth.uid()::text`,
    }),
    pgPolicy("nv2_subscriptions_admin_all", {
      for: "all", to: authenticatedRole, using: isAdmin,
    }),
    pgPolicy("nv2_subscriptions_service_all", {
      for: "all", to: "service_role", using: sql`true`,
    }),
  ]
);

export type NV2Subscription = typeof nv2_subscriptions.$inferSelect;
export type NV2NewSubscription = typeof nv2_subscriptions.$inferInsert;
