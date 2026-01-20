/**
 * Learning Card Table
 * 
 * 학습 카드 테이블 (다각도 학습을 위한 다양한 카드 타입)
 * 각 LearningContent에 속하는 실제 학습 카드를 정의합니다.
 * 
 * 관계:
 * - LearningContent (Many-to-One): 여러 카드가 하나의 콘텐츠에 속함
 * - CardSchedule (One-to-Many): 하나의 카드가 여러 번 푸시될 수 있음
 * - CardFeedback (One-to-Many): 하나의 카드에 여러 피드백
 * 
 * RLS 정책:
 * - Authenticated: 활성화된 상품/콘텐츠의 활성화된 카드만 조회 가능
 * - Admin: 모든 CRUD 작업 가능
 */
import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, jsonb, uuid, integer, index } from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { learningProduct } from '~/features/learning-product/schema';
import { learningContent } from '~/features/learning-content/schema';
import { CARD_TYPES } from "./constants";


/**
 * Learning Card Type Enum
 * 학습 카드 타입
 */
export const cardType = pgEnum(
  "card_type",
  CARD_TYPES
);

/**
 * Card Data Types
 * 카드 타입별 JSONB 데이터 구조
 */

// 의미 + 발음 카드 데이터
export interface MeaningPronunciationCardData {
  word: string;
  meaning: {
    ko: string;
    en?: string;
  };
  ttsText: string;
  phonetic?: string;
}

// 이미지 카드 데이터
export interface ImageCardData {
  word: string;
  imageUrl: string;
  imageSource: 'unsplash' | 'pixabay' | 'pexels' | 'ai-generated';
  altText: string;
  imageAttribution?: string;
}

// 예문 카드 데이터
export interface ExampleSentenceCardData {
  word: string;
  exampleSentence: string;
  translation: {
    ko: string;
    en?: string;
  };
  highlightWord?: boolean;
}

// 어원 카드 데이터
export interface EtymologyCardData {
  word: string;
  etymology: string;
  relatedWords?: string[];
}

// 유의어/반의어 카드 데이터
export interface SynonymAntonymCardData {
  word: string;
  synonyms?: string[];
  antonyms?: string[];
}

// 전체 카드 데이터 타입
export type CardData = 
  | MeaningPronunciationCardData
  | ImageCardData
  | ExampleSentenceCardData
  | EtymologyCardData
  | SynonymAntonymCardData;

export const learningCard = pgTable(
  'learning_card',
  {
    // Primary Key
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    // Foreign Key: LearningContent
    learningContentId: uuid('learning_content_id')
      .notNull()
      .references(() => learningContent.id, { 
        onDelete: 'cascade' // 콘텐츠 삭제 시 카드도 삭제
      }),
    
    // 카드 타입
    cardType: cardType('card_type')
      .notNull(),
    
    // 카드 데이터 (JSONB) - 타입별로 다른 구조
    cardData: jsonb('card_data')
      .$type<CardData>()
      .notNull(),
    
    // 콘텐츠 내 카드 순서 (의미+발음 → 이미지 → 예문 순)
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
    
    // 콘텐츠별 카드 조회 최적화
    index('learning_card_content_idx')
      .on(table.learningContentId),
    
    // 콘텐츠 내 정렬 순서 조회 최적화
    index('learning_card_content_order_idx')
      .on(table.learningContentId, table.displayOrder),
    
    // 활성화된 카드 조회 최적화
    index('learning_card_active_idx')
      .on(table.isActive),
    
    // 카드 타입별 조회 최적화
    index('learning_card_type_idx')
      .on(table.cardType),
    
    // JSONB 카드 데이터 검색 최적화 (GIN 인덱스)
    // index('learning_card_data_gin_idx')
    //   .using('gin', table.cardData), // Drizzle에서 GIN 지원 확인 필요
    
    // ============================================
    // RLS POLICIES
    // ============================================
    
    // Policy 1: Authenticated - 활성화된 상품/콘텐츠의 활성화된 카드만 조회
    pgPolicy('learning_card_select_active', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`
        ${table.isActive} = true
        AND EXISTS (
          SELECT 1 FROM ${learningContent}
          WHERE ${learningContent.id} = ${table.learningContentId}
          AND ${learningContent.isActive} = true
          AND EXISTS (
            SELECT 1 FROM ${learningProduct}
            WHERE ${learningProduct.id} = ${learningContent.learningProductId}
            AND ${learningProduct.isActive} = true
          )
        )
      `,
    }),
    
    // Policy 2: Admin - 모든 카드 조회 가능
    pgPolicy('learning_card_select_admin', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
    
    // Policy 3: Admin만 INSERT 가능
    pgPolicy('learning_card_insert_admin', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: isAdmin,
    }),
    
    // Policy 4: Admin만 UPDATE 가능
    pgPolicy('learning_card_update_admin', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
      withCheck: isAdmin,
    }),
    
    // Policy 5: Admin만 DELETE 가능
    pgPolicy('learning_card_delete_admin', {
      for: 'delete',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
  ],
);

// TypeScript 타입 추론
export type LearningCard = typeof learningCard.$inferSelect;
export type NewLearningCard = typeof learningCard.$inferInsert;