/**
 * Learning Product Table
 * 
 * 학습 상품 테이블 (독일어 A1, 영어 A2 등)
 * 사용자가 구독할 수 있는 학습 콘텐츠 패키지를 정의합니다.
 * 
 * RLS 정책:
 * - Public/Authenticated: 활성화된 상품만 조회 가능
 * - Admin (admins 테이블 기반): 모든 CRUD 작업 가능
 */
import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgTable, text, uuid, integer, index } from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

export const learningProduct = pgTable(
  'learning_product',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    name: text('name')
      .notNull()
      .unique(),
    
    description: text('description'),
    
    isActive: boolean('is_active')
      .notNull()
      .default(true),
    
    displayOrder: integer('display_order')
      .notNull()
      .default(0),
    
    ...timestamps,
  },
  (table) => [
    // ============================================
    // INDEXES
    // ============================================
    
    index('learning_product_active_display_idx')
      .on(table.isActive, table.displayOrder),
    
    // ============================================
    // RLS POLICIES
    // ============================================
    
    // Policy 1: Public - 활성화된 상품만 조회 가능
    pgPolicy('learning_product_select_active', {
      for: 'select',
      to: 'public',
      as: 'permissive',
      using: sql`${table.isActive} = true`,
    }),
    
    // Policy 2: Admin - 모든 상품 조회 가능 (비활성화 포함)
    pgPolicy('learning_product_select_admin', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
    
    // Policy 3: Admin만 INSERT 가능
    pgPolicy('learning_product_insert_admin', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: isAdmin,
    }),
    
    // Policy 4: Admin만 UPDATE 가능
    pgPolicy('learning_product_update_admin', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
      withCheck: isAdmin,
    }),
    
    // Policy 5: Admin만 DELETE 가능
    pgPolicy('learning_product_delete_admin', {
      for: 'delete',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),

    // n8n_worker는 활성화된 상품만 접근
    pgPolicy('learning_product_n8n_worker_select', {
      for: 'select',
      to: 'n8n_worker',
      as: 'permissive',
      using: sql`${table.isActive} = true`,
    }),
  ],
);

export type LearningProduct = typeof learningProduct.$inferSelect;
export type NewLearningProduct = typeof learningProduct.$inferInsert;