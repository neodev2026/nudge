import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, uuid, integer, doublePrecision, timestamp, unique } from "drizzle-orm/pg-core";
import { authUid, authenticatedRole } from "drizzle-orm/supabase";
import { timestamps } from "~/core/db/helpers.server";
import { learningContent } from '~/features/learning-content/schema';

/**
 * Progress tracking table for each content per user.
 * Manages SM-2 variables and the next review schedule.
 */
export const learningContentProgress = pgTable(
  "learning_content_progress",
  {
    userId: uuid("user_id").notNull(),
    learningContentId: uuid("learning_content_id")
      .notNull()
      .references(() => learningContent.id, { onDelete: "cascade" }),
    
    // SM-2 Algorithm variables
    iteration: integer("iteration").notNull().default(0),
    easiness: doublePrecision("easiness").notNull().default(2.5),
    interval: integer("interval").notNull().default(0),
    
    // Index to track progress through the card rotation
    currentCardIndex: integer("current_card_index").notNull().default(0),
    
    // Scheduling metadata
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }).notNull().defaultNow(),
    lastReviewAt: timestamp("last_review_at", { withTimezone: true }),
    
    ...timestamps,
  },
  (table) => [
    // Ensure unique progress record for each user-content pair
    unique('learning_content_progress_unique').on(table.userId, table.learningContentId),

    // RLS: Users can manage their own progress data
    pgPolicy('learning_content_progress_user_manage', {
      for: 'all',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),

    // RLS: n8n_worker has full access to perform automated scheduling and updates
    pgPolicy('learning_content_progress_worker_all', {
      for: 'all',
      to: 'n8n_worker',
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ]
);