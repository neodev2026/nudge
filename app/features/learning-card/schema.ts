import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, jsonb, uuid, integer, index, text, doublePrecision, timestamp, unique } from "drizzle-orm/pg-core";
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

    // [추가된 Policy] n8n_worker: 자동화 워크플로우를 위한 정책
    // 1. 조회: 전체 카드 상태 모니터링 및 중복 확인을 위해 모든 카드 조회 허용
    pgPolicy('learning_card_n8n_worker_select', {
      for: 'select',
      to: 'n8n_worker',
      as: 'permissive',
      using: sql`true`, // 워커는 관리를 위해 전체 조회가 필요한 경우가 많음
    }),
        
    // 2. 삽입: AI가 생성한 신규 카드를 테이블에 넣기 위해 허용
    pgPolicy('learning_card_n8n_worker_insert', {
      for: 'insert',
      to: 'n8n_worker',
      as: 'permissive',
      withCheck: sql`true`,
    }),    
  ]
);

/**
 * 단어별 통합 학습 진도 테이블
 * 한 사용자가 특정 단어에 대해 가지는 통합적인 SM-2 상태를 관리합니다.
 */
export const learningContentProgress = pgTable(
  "learning_content_progress",
  {
    userId: uuid("user_id").notNull(),
    learningContentId: uuid("learning_content_id")
      .notNull()
      .references(() => learningContent.id, { onDelete: "cascade" }),
    
    // SM-2 알고리즘 변수
    iteration: integer("iteration").notNull().default(0),
    easiness: doublePrecision("easiness").notNull().default(2.5),
    interval: integer("interval").notNull().default(0),
    
    // 카드 순환 관리 (9개 카드를 순차적으로 보여주기 위한 인덱스)
    currentCardIndex: integer("current_card_index").notNull().default(0),
    
    // 복습 일정 관리
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }).notNull().defaultNow(),
    lastReviewAt: timestamp("last_review_at", { withTimezone: true }),
    
    ...timestamps,
  },
  (table) => [
    // 사용자와 단어 ID의 조합으로 유니크한 진도를 보장합니다.
    unique('learning_content_progress_unique').on(table.userId, table.learningContentId),

    // RLS Policies
    
    // 1. 일반 사용자: 본인의 진도 데이터만 관리 가능
    pgPolicy('learning_content_progress_user_manage', {
      for: 'all',
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),

    // 2. n8n_worker: 복습 알림 및 자동화 처리를 위해 전체 데이터 접근 허용
    pgPolicy('learning_content_progress_worker_all', {
      for: 'all',
      to: 'n8n_worker',
      as: 'permissive',
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ]
);