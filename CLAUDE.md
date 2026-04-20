# Nudge v2

언어 학습 서비스. Discord DM으로 학습 세션 링크를 발송하는 구조.

## 스택
- React Router v7 (Remix mode)
- Supabase PostgreSQL + Drizzle ORM
- Shadcn/ui + Tailwind CSS
- Vercel 배포, Cloudflare DNS
- n8n 자동화 워크플로우

## 핵심 규칙
- DB 스키마 변경: schema.ts 수정 → npm run db:generate → npm run db:migrate 순서 필수
- 코드 코멘트: 영어로 작성
- 커밋 메시지: 영어로 작성
- 미사용 코드: 삭제 말고 주석 처리
- loader 패턴: useLoaderData<typeof loader>() 사용 (Route.ComponentProps 금지)
- RLS 우회: adminClient 사용

## 설계 문서
- doc\nudge-v2-design-2026-04-20.md
- doc\nudge-story-learning-spec.md