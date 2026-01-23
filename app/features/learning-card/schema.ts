import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, jsonb, uuid, integer, index } from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { learningContent } from '~/features/learning-content/schema';
import { learningProduct } from '~/features/learning-product/schema'; // 정책 참조용
import { CARD_TYPES, CARD_SCOPES } from "./constants";

export const cardType = pgEnum("card_type", CARD_TYPES);
export const cardScope = pgEnum("card_scope", CARD_SCOPES);

/**
 * 카드 타입별 상세 데이터 구조 (개정)
 */

// 발음 카드 (pronunciation)
export interface PronunciationCardData {
  word: string;
  ipa: string;
  koreanApproximation: string;
  commonMistakes?: { wrong: string; correct: string };
}

// 빈칸 채우기 (cloze)
export interface ClozeCardData {
  sentence: string;
  answer: string;
  translation: { ko: string };
  pattern?: string;
}

// 대조 학습 (contrast)
export interface ContrastCardData {
  word: string;
  contrastWord: string;
  difference: string;
  visualEmoji?: { primary: string; contrast: string };
}

// 개인화 컨텍스트 (Personalization)
export interface PersonalizationContext {
  userId: string;
  job?: string;
  interests?: string[];
  aiModel?: string;
}

export type CardData = 
  | PronunciationCardData 
  | ClozeCardData 
  | ContrastCardData 
  | any; // 다른 타입들은 이전 정의 또는 유연한 확장 허용

export const learningCard = pgTable(
  'learning_card',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    learningContentId: uuid('learning_content_id')
      .notNull()
      .references(() => learningContent.id, { onDelete: 'cascade' }),
    
    cardType: cardType('card_type').notNull(),
    
    // [변경 사항] 공유 카드와 개인화 카드 구분
    cardScope: cardScope('card_scope').notNull().default('shared'),
    
    cardData: jsonb('card_data').$type<CardData>().notNull(),
    
    // [변경 사항] VIP 개인화 생성 시 사용된 맥락 정보
    personalizationContext: jsonb('personalization_context').$type<PersonalizationContext>(),
    
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    
    ...timestamps,
  },
  (table) => [
    index('learning_card_content_idx').on(table.learningContentId),
    index('learning_card_type_idx').on(table.cardType),
    
    // [변경 사항] 개인화 카드 필터링 및 범위별 조회 인덱스 추가
    index('learning_card_scope_idx').on(table.cardScope),
    index('learning_card_user_context_idx').on(sql`(${table.personalizationContext}->>'userId')`),

    // RLS Policies
    // Policy 1: 자신의 개인화 카드 또는 모든 공유 카드만 조회 가능하도록 수정
    pgPolicy('learning_card_select_scoped', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`
        ${table.isActive} = true AND (
          ${table.cardScope} = 'shared' OR 
          (${table.cardScope} = 'personalized' AND (${table.personalizationContext}->>'userId')::uuid = ${authUid})
        )
      `,
    }),
    
    // [Policy 2] Admin: 모든 권한 (기존 관리자 정책 유지)
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
  ],
);