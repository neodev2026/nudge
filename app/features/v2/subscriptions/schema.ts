import { sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { tstz, eventTstz, userIdentity } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";
import { V2_LINK_ACCESS_TYPES } from "~/features/v2/shared/constants";
import { nv2_learning_products } from "~/features/v2/products/schema";

export const nv2LinkAccessType = pgEnum(
  "nv2_link_access_type",
  V2_LINK_ACCESS_TYPES
);

/**
 * nv2_subscriptions
 *
 * Tracks which learning products a user has subscribed to,
 * and per-subscription settings such as link_access control.
 *
 * link_access = 'public' (default):
 *   Session links work without login.
 *   sns_type/sns_id are resolved directly from the session row.
 *   Suitable for mobile Discord DM users.
 *
 * link_access = 'members_only':
 *   Session link requires Discord OAuth login.
 *   Non-authenticated users are redirected to:
 *   /auth/discord/start?next=/sessions/:id
 */
export const nv2_subscriptions = pgTable(
  "nv2_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Profile reference — FK to nv2_profiles(auth_user_id)
    ...userIdentity,

    product_id: uuid("product_id")
      .notNull()
      .references(() => nv2_learning_products.id, { onDelete: "cascade" }),
    link_access: nv2LinkAccessType("link_access").notNull().default("public"),
    is_active: boolean("is_active").notNull().default(true),
    started_at: eventTstz("started_at"),
    ...tstz,
  },
  (table) => [
    index("nv2_subscriptions_user_product_idx").on(
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
