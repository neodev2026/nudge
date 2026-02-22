import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, timestamp, uuid, integer, index, unique } from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { learningProduct } from '~/features/learning-product/schema';
import { learningContent } from '~/features/learning-content/schema';

/**
 * User Learning Content Progress Table
 */
export const userLearningContentProgress = pgTable(
  'user_learning_content_progress',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    
    learningProductId: uuid('learning_product_id')
      .notNull()
      .references(() => learningProduct.id, { onDelete: 'cascade' }),
    
    learningContentId: uuid('learning_content_id')
      .notNull()
      .references(() => learningContent.id, { onDelete: 'cascade' }),
    
    lastStudiedAt: timestamp('last_studied_at', { withTimezone: true }),
    
    studyCount: integer('study_count')
      .notNull()
      .default(0),
    
    lastFeedbackScore: integer('last_feedback_score'),
    
    ...timestamps,
  },
  (table) => [
    // CONSTRAINTS
    unique('user_content_progress_unique')
      .on(table.userId, table.learningProductId, table.learningContentId),
    
    // INDEXES
    index('user_progress_user_idx').on(table.userId),
    index('user_progress_user_product_idx').on(table.userId, table.learningProductId),
    index('user_progress_user_product_studied_idx').on(table.userId, table.learningProductId, table.lastStudiedAt),
    index('user_progress_feedback_score_idx').on(table.userId, table.lastFeedbackScore),
    
    // ============================================
    // RLS POLICIES
    // ============================================
    
    // 1. n8n_worker: Permissive access for background updates (Essential for Flow 5)
    pgPolicy('user_progress_worker_manage', {
      for: 'all',
      to: 'n8n_worker',
      as: 'permissive',
      using: sql`true`,
      withCheck: sql`true`,
    }),

    // 2. Standard Users: Select own progress
    pgPolicy('user_progress_select_own_2', {
      for: 'select',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    
    // 3. Standard Users: Insert own progress
    pgPolicy('user_progress_insert_own_2', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`, 
    }),

    // 4. Standard Users: Update own progress
    pgPolicy('user_progress_update_own_2', {
      for: 'update',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),

    // 5. Admin: Full access via helper functions
    pgPolicy('user_progress_admin_all', {
      for: 'all',
      to: authenticatedRole,
      using: isAdmin,
    }),
  ],
);

export type UserLearningContentProgress = typeof userLearningContentProgress.$inferSelect;
export type NewUserLearningContentProgress = typeof userLearningContentProgress.$inferInsert;