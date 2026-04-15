import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { tstz } from "~/core/db/helpers.server";

/**
 * nv2_site_settings
 *
 * Single-row site-wide configuration table (id = 1 always).
 * Used for runtime flags that need to be toggled without redeployment.
 *
 * Current fields:
 *   maintenance_mode    — redirects all non-admin routes to /maintenance
 *   maintenance_message — displayed on the maintenance page
 *   maintenance_until   — optional estimated end time shown on the page
 */
export const nv2_site_settings = pgTable(
  "nv2_site_settings",
  {
    // Always 1 — enforced by check constraint
    id: integer("id").primaryKey().default(1),

    maintenance_mode: boolean("maintenance_mode").notNull().default(false),

    maintenance_message: text("maintenance_message")
      .notNull()
      .default("서비스 점검 중입니다. 잠시 후 다시 이용해주세요."),

    // Optional: estimated end time shown on the maintenance page
    maintenance_until: timestamp("maintenance_until", {
      withTimezone: true,
      mode: "string",
    }),

    ...tstz,
  },
  (table) => [
    // Enforce single-row: id must always be 1
    pgPolicy("nv2_site_settings_check_single_row", {
      for: "all",
      to: "public",
      using: sql`${table.id} = 1`,
    }),

    // RLS: service_role full access (admin API uses service_role client)
    pgPolicy("nv2_site_settings_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
  ]
);

export type NV2SiteSettings = typeof nv2_site_settings.$inferSelect;
