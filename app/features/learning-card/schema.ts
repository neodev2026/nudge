import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, jsonb, uuid, integer, index, text } from "drizzle-orm/pg-core";
import { authUid, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { learningContent } from '~/features/learning-content/schema';
import { CARD_TYPES, CARD_SCOPES } from "./constants";

export const cardType = pgEnum("card_type", CARD_TYPES);
export const cardScope = pgEnum("card_scope", CARD_SCOPES);

import { type StandardizedCardData } from "./types";


export const learningCard = pgTable(
  "learning_card",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    learningContentId: uuid("learning_content_id")
      .notNull()
      .references(() => learningContent.id, { onDelete: "cascade" }),
    
    cardType: cardType("card_type").notNull(),
    cardScope: cardScope("card_scope").notNull().default("shared"),
    
    // 표준화된 인터페이스를 담는 JSONB 필드
    cardData: jsonb("card_data").$type<StandardizedCardData>().notNull(),
    
    displayOrder: integer("display_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(false), // 기본값 false (검수 전)

    /**
     * [신규 추가] 데이터 검증 및 품질 관리 필드
     */
    isValid: boolean("is_valid").notNull().default(true),
    errorMessage: text("error_message"),
    
    ...timestamps,
  },
  (table) => [
    index('learning_card_content_idx').on(table.learningContentId),
    index('learning_card_type_idx').on(table.cardType),
    index('learning_card_scope_idx').on(table.cardScope),
    // 검수 실패 항목 조회를 위한 인덱스 추가
    index('learning_card_validation_idx').on(table.isValid).where(sql`${table.isValid} = false`),

    // RLS Policies
    // [보완] 일반 사용자는 (활성화된 카드) AND (검증 통과된 카드)만 조회 가능
    pgPolicy('learning_card_select_scoped', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`
        ${table.isActive} = true AND 
        ${table.isValid} = true AND (
          ${table.cardScope} = 'shared' OR 
          (${table.cardScope} = 'personalized' AND (${table.cardData}->'meta'->>'userId')::uuid = ${authUid})
        )
      `,
    }),
    
    // Admin: 검증 실패 항목을 포함한 모든 데이터 접근 가능
    pgPolicy('learning_card_admin_all', {
      for: 'all',
      to: authenticatedRole,
      using: isAdmin,
    }),

    // n8n worker: 배치 처리를 위한 모든 접근 허용
    pgPolicy('learning_card_n8n_worker_all', {
      for: 'all',
      to: authenticatedRole,
      using: isAdmin, // 혹은 특정 worker 권한 체크
    }),
  ]
);