import { sql } from 'drizzle-orm';

/**
 * Admin 권한 체크 SQL 헬퍼
 * admins 테이블에 현재 사용자 이메일이 있는지 확인
 */
export const isAdmin = sql`
  EXISTS (
    SELECT 1 FROM admins
    WHERE email = (auth.jwt()->>'email')::text
  )
`;