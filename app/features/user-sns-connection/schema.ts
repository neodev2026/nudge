/**
 * User SNS Connection Table
 * 
 * 사용자 SNS 연결 정보 테이블
 * 각 사용자가 어떤 SNS 채널로 학습 카드 푸시를 받을지 관리
 * 
 * 생성 시점:
 * - 사용자가 SNS 채널을 연결할 때
 * - 회원가입 시 이메일은 자동으로 생성
 * 
 * 관계:
 * - auth.users (Many-to-One): 여러 SNS 연결이 한 사용자에게 속함
 * - UserProductSubscription (One-to-Many): 한 SNS 연결로 여러 구독
 * - CardSchedule (One-to-Many): 한 SNS 연결로 여러 카드 푸시
 * 
 * RLS 정책:
 * - Authenticated: 본인의 SNS 연결만 CRUD 가능
 * - Admin: 모든 사용자의 SNS 연결 조회 가능
 */

import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgEnum, pgTable, text, timestamp, uuid, integer, index, unique } from "drizzle-orm/pg-core";
import { authUid, authUsers, authenticatedRole } from "drizzle-orm/supabase";

import { timestamps } from "~/core/db/helpers.server";
import { isAdmin } from '~/core/db/helpers.rls';

import { SNS_TYPES } from "./constants";



/**
 * SNS Type Enum
 * 지원하는 SNS 채널 타입
 */
export const snsType = pgEnum(
  "sns_type",
  SNS_TYPES
);

export const userSNSConnection = pgTable(
  'user_sns_connection',
  {
    // Primary Key
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    // Foreign Key: auth.users
    userId: uuid('user_id')
      .notNull()
      .references(() => authUsers.id, { 
        onDelete: 'cascade' // 사용자 삭제 시 SNS 연결도 삭제
      }),
    
    // SNS 타입 (discord, kakao, email, telegram)
    snsType: snsType('sns_type')
      .notNull(),
    
    // SNS 식별자
    // - discord: Discord User ID (예: "123456789012345678")
    // - kakao: 카카오톡 User ID
    // - email: 이메일 주소 (예: "user@example.com")
    snsIdentifier: text('sns_identifier')
      .notNull(),
    
    // 주 푸시 채널 여부 (한 사용자는 하나의 주 채널만 가질 수 있음)
    isPrimary: boolean('is_primary')
      .notNull()
      .default(false),
    
    // 푸시 활성화 여부
    pushEnabled: boolean('push_enabled')
      .notNull()
      .default(true),
    
    // SNS 연동 확인 시간 (푸시 테스트 완료)
    // NULL이면 아직 확인되지 않음 → 푸시 불가
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    
    // Standard timestamps
    ...timestamps,
  },
  (table) => [
    // ============================================
    // CONSTRAINTS
    // ============================================
    
    // Unique constraint: 같은 사용자는 같은 SNS 타입+식별자를 중복 등록 불가
    unique('user_sns_connection_unique')
      .on(table.userId, table.snsType, table.snsIdentifier),
    
    // ============================================
    // INDEXES
    // ============================================
    
    // 사용자별 SNS 연결 조회 최적화
    index('user_sns_user_idx')
      .on(table.userId),
    
    // 주 채널 조회 최적화
    index('user_sns_primary_idx')
      .on(table.userId, table.isPrimary),
    
    // SNS 타입별 조회 최적화
    index('user_sns_type_idx')
      .on(table.snsType),
    
    // SNS 식별자로 조회 최적화 (Discord ID, 이메일 등으로 사용자 찾기)
    index('user_sns_identifier_idx')
      .on(table.snsIdentifier),
    
    // 확인된 연결 조회 최적화
    index('user_sns_verified_idx')
      .on(table.userId, table.verifiedAt),
    
    // ============================================
    // RLS POLICIES
    // ============================================
    
    // Policy 1: Authenticated - 본인의 SNS 연결만 조회 가능
    pgPolicy('user_sns_select_own', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`${table.userId} = ${authUid}`,
    }),
    
    // Policy 2: Admin - 모든 사용자의 SNS 연결 조회 가능
    pgPolicy('user_sns_select_admin', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
    
    // Policy 3: Authenticated - 본인의 SNS 연결만 생성 가능
    pgPolicy('user_sns_insert_own', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    
    // Policy 4: Admin - Admin은 모든 SNS 연결 생성 가능
    pgPolicy('user_sns_insert_admin', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: isAdmin,
    }),
    
    // Policy 5: Authenticated - 본인의 SNS 연결만 수정 가능
    pgPolicy('user_sns_update_own', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    
    // Policy 6: Admin - Admin은 모든 SNS 연결 수정 가능
    pgPolicy('user_sns_update_admin', {
      for: 'update',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
      withCheck: isAdmin,
    }),
    
    // Policy 7: Authenticated - 본인의 SNS 연결만 삭제 가능
    pgPolicy('user_sns_delete_own', {
      for: 'delete',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`${table.userId} = ${authUid}`,
    }),
    
    // Policy 8: Admin - Admin은 모든 SNS 연결 삭제 가능
    pgPolicy('user_sns_delete_admin', {
      for: 'delete',
      to: authenticatedRole,
      as: 'permissive',
      using: isAdmin,
    }),
  ],
);

// TypeScript 타입 추론
export type UserSNSConnection = typeof userSNSConnection.$inferSelect;
export type NewUserSNSConnection = typeof userSNSConnection.$inferInsert;