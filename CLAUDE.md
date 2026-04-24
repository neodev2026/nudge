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

## 디버깅 규칙
- loader 에러 추적: 문제 발생 시 단계별 `console.log`를 즉시 추가해 어느 쿼리가 실패하는지 먼저 특정한다. 가설로 코드를 수정하기 전에 반드시 원인을 확인한다.
- Supabase 에러 throw: `if (err) throw err` 금지. 반드시 `throw new Error(err.message)`로 감싸 ErrorBoundary가 인식할 수 있는 Error 인스턴스로 던진다.
- `.in()` 쿼리 크기 주의: PostgREST는 `.in()` 조건을 URL 파라미터로 전송한다. 수십 개 이상의 ID가 들어가면 URL 길이 초과로 `TypeError: fetch failed`가 발생한다. 부모-자식 관계(예: stage → cards)는 항상 nested select를 사용한다.

## 설계 문서
- doc\nudge-v2-design-2026-04-20.md
- doc\nudge-story-learning-spec.md