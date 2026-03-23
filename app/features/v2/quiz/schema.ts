import { sql } from "drizzle-orm";
import {
  bigserial,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { tstz } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";
import { QUIZ_TYPES, SNS_TYPES } from "~/features/v2/shared/constants";
import type { QuizResultSnapshot } from "~/features/v2/shared/types";

export const nv2QuizType = pgEnum("nv2_quiz_type", QUIZ_TYPES);

/**
 * nv2_quiz_results
 *
 * Records the outcome of each quiz stage attempt.
 *
 * Triggering rules (enforced at application level):
 * - quiz_5  : fired after every 5 NEW stage completions.
 *             At the 10th completion, quiz_5 fires first (covering stages 6~10),
 *             then quiz_10 fires immediately after quiz_5 is completed.
 * - quiz_10 : fired after every 10 NEW stage completions, always preceded by quiz_5.
 * - After stage 703 (final): a quiz_5 covering the last ≤5 completed stages is triggered.
 *
 * Card pool rules:
 * - quiz_5  : 3 title cards + 3 description cards from the most recent 5 stages
 * - quiz_10 : 4 title cards + 4 description cards from the most recent 10 stages
 *
 * Matching mechanic:
 * - User taps a title card, then its matching description card (or vice versa)
 * - A correct pair disappears and is replaced by two new cards from the pool
 * - Each loop runs for 20 seconds (infinite loops until the timer expires)
 * - matched_pairs_count = total correct pairs across all loops within the session
 *
 * Only NEW stage completions increment the quiz trigger counter.
 * Review completions do not count.
 */
export const nv2_quiz_results = pgTable(
  "nv2_quiz_results",
  {
    quiz_result_id: bigserial("quiz_result_id", { mode: "bigint" }).primaryKey(),

    sns_type: text("sns_type")
      .notNull()
      .$type<(typeof SNS_TYPES)[number]>(),
    sns_id: text("sns_id").notNull(),

    quiz_type: nv2QuizType("quiz_type").notNull(),

    // Cumulative new-stage count at the moment this quiz was triggered
    trigger_at_count: integer("trigger_at_count").notNull(),

    // Ordered list of stage IDs covered by this quiz
    covered_stage_ids: uuid("covered_stage_ids").array().notNull(),

    // Total correctly matched pairs across all 20-second loops
    matched_pairs_count: integer("matched_pairs_count").notNull().default(0),

    // Full result snapshot for analytics
    result_snapshot: jsonb("result_snapshot").$type<QuizResultSnapshot>(),

    // When the user opened the quiz link
    started_at: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
    }).notNull().defaultNow(),

    // When the final loop timer expired and the result was submitted
    completed_at: timestamp("completed_at", {
      withTimezone: true,
      mode: "date",
    }),

    ...tstz,
  },
  (table) => [
    index("nv2_quiz_results_profile_idx").on(table.sns_type, table.sns_id),
    index("nv2_quiz_results_type_idx").on(table.quiz_type),
    index("nv2_quiz_results_trigger_idx").on(
      table.sns_type,
      table.sns_id,
      table.trigger_at_count
    ),

    // RLS: Users can read only their own quiz results
    pgPolicy("nv2_quiz_results_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = ${table.sns_type}::text
            AND p.sns_id         = ${table.sns_id}
            AND p.auth_user_id   = auth.uid()::text
        )
      `,
    }),

    pgPolicy("nv2_quiz_results_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`
        EXISTS (
          SELECT 1 FROM nv2_profiles p
          WHERE p.sns_type::text = ${table.sns_type}::text
            AND p.sns_id         = ${table.sns_id}
            AND p.auth_user_id   = auth.uid()::text
        )
      `,
    }),

    // RLS: Admin full access
    pgPolicy("nv2_quiz_results_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),

    // RLS: Service role
    pgPolicy("nv2_quiz_results_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
  ]
);
