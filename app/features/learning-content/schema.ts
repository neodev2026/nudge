/**
 * Learning Content Table
 * 
 * 학습 콘텐츠 테이블 (단어, 문장, 수식 등)
 * 각 LearningProduct에 속하는 실제 학습 내용을 정의합니다.
 * 
 * 관계:
 * - LearningProduct (One-to-Many): 하나의 상품에 여러 콘텐츠
 * - LearningCard (One-to-Many): 하나의 콘텐츠에 여러 학습 카드
 * 
 * RLS 정책:
 * - Public/Authenticated: 활성화된 상품의 활성화된 콘텐츠만 조회 가능
 * - Admin: 모든 CRUD 작업 가능
 */
import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, text, uuid, integer, index } from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { learningProduct } from '~/features/learning-product/schema';
import { CONTENT_TYPES } from "./constants";


export const contentType = pgEnum(
  "content_type",
  CONTENT_TYPES
);

export const learningContent = pgTable(
  'learning_content',
  {
    // Primary Key
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    // Foreign Key: LearningProduct
    learningProductId: uuid('learning_product_id')
      .notNull()
      .references(() => learningProduct.id, { 
        onDelete: 'cascade' // 상품 삭제 시 콘텐츠도 삭제
      }),
    
    // 콘텐츠 타입 (word: 단어, sentence: 문장, formula: 수식)
    contentType: contentType('content_type')
      .notNull(),
    
    // 콘텐츠 이름 (예: "Haus", "Der Baum ist groß")
    contentName: text('content_name')
      .notNull(),
    
    // 설명/메모 (관리자용, 예: "집", "그 나무는 크다")
    description: text('description'),
    
    // 상품 내 콘텐츠 순서
    displayOrder: integer('display_order')
      .notNull()
      .default(0),
    
    // 활성화 여부
    isActive: boolean('is_active')
      .notNull()
      .default(true),
    
    // Standard timestamps
    ...timestamps,
  },
  (table) => [
    // ============================================
    // INDEXES
    // ============================================
    
    // 상품별 콘텐츠 조회 최적화
    index('learning_content_product_idx')
      .on(table.learningProductId),
    
    // 상품 내 정렬 순서 조회 최적화
    index('learning_content_product_order_idx')
      .on(table.learningProductId, table.displayOrder),
    
    // 활성화된 콘텐츠 조회 최적화
    index('learning_content_active_idx')
      .on(table.isActive),
    
    // 콘텐츠 타입별 조회 최적화
    index('learning_content_type_idx')
      .on(table.contentType),
    
    // ============================================
    // RLS POLICIES
    // ============================================
    
    // Policy 1: Public/Authenticated - 활성화된 상품의 활성화된 콘텐츠만 조회
    pgPolicy('learning_content_select_active', {
      for: 'select',
      to: 'public',
      as: 'permissive',
      using: sql`
        ${table.isActive} = true
        AND EXISTS (
          SELECT 1 FROM ${learningProduct}
          WHERE ${learningProduct.id} = ${table.learningProductId}
          AND ${learningProduct.isActive} = true
        )
      `,
    }),
    
    // Policy 2: Admin - 모든 콘텐츠 조회 가능
    pgPolicy('learning_content_select_admin', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
    
    // Policy 3: Admin만 INSERT 가능
    pgPolicy('learning_content_insert_admin', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: isAdmin,
    }),
    
    // Policy 4: Admin만 UPDATE 가능
    pgPolicy('learning_content_update_admin', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
      withCheck: isAdmin,
    }),
    
    // Policy 5: Admin만 DELETE 가능
    pgPolicy('learning_content_delete_admin', {
      for: 'delete',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),

    // n8n_worker는 활성화된 콘텐츠만 접근
    pgPolicy('learning_content_n8n_worker_select', {
      for: 'select',
      to: 'n8n_worker',
      as: 'permissive',
      using: sql`${table.isActive} = true`,
    }),
  ],
);

// TypeScript 타입 추론
export type LearningContent = typeof learningContent.$inferSelect;
export type NewLearningContent = typeof learningContent.$inferInsert;