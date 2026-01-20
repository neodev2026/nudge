import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, pgPolicy } from 'drizzle-orm/pg-core';
import { authUsers, authenticatedRole, authUid } from 'drizzle-orm/supabase';

/**
 * Admins Table
 * 관리자 이메일 목록 관리
 * 이 테이블에 등록된 이메일만 관리자 권한 획득
 */
export const admins = pgTable(
  'admins',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    
    email: text('email')
      .notNull()
      .unique(),
    
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // 모든 인증된 사용자가 admin 목록 조회 가능 (자신이 admin인지 확인용)
    pgPolicy('admins_select_all', {
      for: 'select',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`true`,
    }),
    
    // Admin만 새로운 Admin 추가 가능
    pgPolicy('admins_insert_admin', {
      for: 'insert',
      to: authenticatedRole,
      as: 'permissive',
      withCheck: sql`
        EXISTS (
          SELECT 1 FROM admins
          WHERE email = (auth.jwt()->>'email')::text
        )
      `,
    }),
    
    // Admin만 Admin 삭제 가능
    pgPolicy('admins_delete_admin', {
      for: 'delete',
      to: authenticatedRole,
      as: 'permissive',
      using: sql`
        EXISTS (
          SELECT 1 FROM admins
          WHERE email = (auth.jwt()->>'email')::text
        )
      `,
    }),
  ],
);

export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;