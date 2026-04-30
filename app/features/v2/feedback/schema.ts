import { sql } from "drizzle-orm";
import {
  boolean,
  index,
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
// Enums — values inlined to avoid drizzle-kit ZodError with constants imports
// ---------------------------------------------------------------------------

export const nv2FeedbackCategory = pgEnum("nv2_feedback_category", [
  "error",       // 오류 신고
  "content",     // 콘텐츠 오류
  "suggestion",  // 개선 제안
  "other",       // 기타
]);

// ---------------------------------------------------------------------------
// nv2_feedback — user-submitted feedback and bug reports
// ---------------------------------------------------------------------------

export const nv2_feedback = pgTable(
  "nv2_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Nullable: anonymous and unauthenticated users can submit
    auth_user_id: text("auth_user_id"),

    page_url: text("page_url").notNull(),
    category: nv2FeedbackCategory("category").notNull(),
    content: text("content").notNull(),

    is_resolved: boolean("is_resolved").notNull().default(false),

    // Optional admin note
    admin_note: text("admin_note"),

    ...tstz,
  },
  (table) => [
    index("nv2_feedback_category_idx").on(table.category),
    index("nv2_feedback_resolved_idx").on(table.is_resolved),
    index("nv2_feedback_created_at_idx").on(table.created_at),

    // Anyone (including unauthenticated) can submit feedback
    pgPolicy("nv2_feedback_insert_public", {
      for: "insert",
      to: "public",
      withCheck: sql`true`,
    }),

    // Service role (adminClient) has full access
    pgPolicy("nv2_feedback_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),

    // Admin users have full access
    pgPolicy("nv2_feedback_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),
  ]
);

export type NV2Feedback = typeof nv2_feedback.$inferSelect;
export type NV2NewFeedback = typeof nv2_feedback.$inferInsert;
