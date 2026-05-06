# Nudge v2

언어 학습 서비스. Discord DM으로 학습 세션 링크를 발송하는 구조.

## 스택
- React Router v7 (Remix mode)
- Supabase PostgreSQL + Drizzle ORM
- Shadcn/ui + Tailwind CSS
- Vercel 배포, Cloudflare DNS
- n8n 자동화 워크플로우

---

## 문서 구조

```
docs/
├── core/          # 최우선 참조 — 태스크 시작 전 반드시 읽는다
│   ├── nudge-v2-design-YYYY-MM-DD.md   # 설계 문서 (최고 우선순위)
│   ├── *-prd.md                        # 피처별 PRD
│   ├── *-task.md                       # 피처별 태스크 카드
│   └── *-test-plan.md                  # 피처별 테스트 플랜
├── ops/           # 운영 체크리스트
│   ├── post-deploy-regression.md       # 매 배포 후 실시
│   └── test-results/                   # 수동 TC 결과 로그
└── archive/       # 구버전 — 충돌 시 무시
```

### 문서 우선순위 (높은 순)

1. `docs/core/nudge-v2-design-YYYY-MM-DD.md` — 최신 버전
2. 피처 PRD (`*-prd.md`)
3. 피처 태스크 (`*-task.md`)
4. 이 파일 (CLAUDE.md)
5. 아카이브 — **상위 문서와 충돌 시 무시**

두 문서가 서로 충돌할 경우, 우선순위가 높은 문서를 따르고 개발자에게 먼저 알린다.

---

## 핵심 개발 규칙

### DB 스키마 변경
순서를 절대 건너뛰지 않는다:
```
1. db/schema.ts 수정
2. npm run db:generate
3. npm run db:migrate
```
- Supabase SQL Editor를 통한 직접 SQL 실행은 **금지**
- SQL 함수·트리거는 `sql/functions/`에서 관리, Supabase SQL Editor로만 적용
- Enum 값은 schema 파일 인라인 정의 — `constants.ts`에서 import 금지

### Route 등록
- 반드시 **라우트 파일 생성 후** `routes.ts`에 등록한다
- 파일 없이 routes.ts 등록 시 React Router 7 `ENOENT` 크래시 발생

### 코드 스타일
- 코드 코멘트: 영어로 작성
- 커밋 메시지: 영어로 작성
- 미사용 코드: 삭제 말고 주석 처리
- loader 패턴: `useLoaderData<typeof loader>()` 사용 (`Route.ComponentProps` 금지)

### 익명 사용자
- `auth_user_id.startsWith('anon:')` 으로 식별
- OpenAI API 호출 차단 → 안내 메시지 반환
- Marathon Mode: `/login?next=/products/:slug/marathon` 으로 리디렉트

### RLS 정책
- RLS 우회: `adminClient` 사용
- Enum 컬럼을 text와 비교할 때 `::text` 캐스트 필수
  - 예: `status::text = 'active'::text`

---

## 디버깅 규칙

- **loader 에러 추적**: 문제 발생 시 단계별 `console.log`를 즉시 추가해 어느 쿼리가 실패하는지 먼저 특정한다. 가설로 코드를 수정하기 전에 반드시 원인을 확인한다.
- **Supabase 에러 throw**: `if (err) throw err` 금지. 반드시 `throw new Error(err.message)`로 감싸 ErrorBoundary가 인식할 수 있는 Error 인스턴스로 던진다.
- **`.in()` 쿼리 크기**: PostgREST는 `.in()` 조건을 URL 파라미터로 전송한다. 수십 개 이상의 ID → URL 길이 초과 → `TypeError: fetch failed`. 부모-자식 관계(예: stage → cards)는 항상 nested select 사용.

---

## 테스트 규칙

### 코드 변경 후 매회 실행
```bash
npm run test
```
테스트 실패 시 완료 보고 전에 반드시 수정한다.

### 테스트 유형별 기준

| 유형 | 도구 | 시점 |
|---|---|---|
| 단위 테스트 | Vitest | 순수 로직 함수 구현 후 |
| 통합 테스트 | Vitest + Supertest | API 엔드포인트 구현 후 |
| 수동 TC | Test Plan 문서 | 스테이징 배포 후 |
| 회귀 테스트 | post-deploy-regression.md | 매 Production 배포 후 |

### 자동화 불가 항목 (수동 확인 필수)
- TTS 오디오 재생
- 브라우저 세션 이어하기 플로우
- UI 렌더링 및 레이아웃

---

## 태스크 워크플로우

매 피처 구현 시 아래 순서를 따른다:

```
1. docs/core/ 읽기 → 설계 문서·PRD 확인
2. 코드 작성 전 개발자와 접근 방식 확인
3. DB 스키마 변경 (필요 시): schema.ts → db:generate → db:migrate
4. routes.ts 등록 전 라우트 파일 먼저 생성
5. API 엔드포인트 구현
6. UI 화면 구현
7. npm run test 실행
8. 완료 보고 — 어떤 AC 항목이 확인되었는지 목록으로 제시
9. 개발자가 Test Plan 기준으로 수동 TC 실시
10. 설계 문서에 changelog 항목 추가 후 영어로 커밋
```

---

## Known Pitfalls

| 상황 | 규칙 |
|---|---|
| TTS 루프 버그 | 루프 상태 플래그는 훅 내부 `useRef`가 아니라 모듈 레벨 변수 사용 |
| CRLF 파일 | Python `rb` 모드로 읽고 `\r\n` → `\n` 명시적 변환 |
| n8n Code 노드 | `{ json: {...} }` 반환 (배열 금지); "Run Once For Each Item" 모드에서 `$('NodeName').item.json` 사용 |
| Supabase upsert | `nv2_subscriptions` upsert는 unique constraint 확인 후 실시 |
| 익명 세션 | `daily-reset` cron으로 7일 후 자동 삭제 |
| `.in()` URL 초과 | 부모-자식 관계는 nested select 사용 (디버깅 규칙 참고) |
| routes.ts 등록 순서 | 파일 생성 전 등록 시 ENOENT 크래시 — 파일 먼저, 등록 나중 |

---

## 현재 상태

- **서비스**: 클로즈 베타 (7명)
- **완료된 주요 피처**: 이메일/Google/Discord OAuth, 학습 세션, TTS, Quiz, Marathon Mode, Leni AI 채팅, Story Learning, 이메일 알림, Discord DM (n8n), 관리자 대시보드
- **진행 중**: 없음 (다음 피처 기획 중)

---

## 구현 범위 외 (명시적 지시 없이 구현 금지)

- 결제 연동 (Stripe / Toss)
- KakaoTalk / Telegram 알림
- 리더보드 / 멀티 유저 비교
- 모바일 네이티브 앱
- "오답만 보기" 모드 (PMF 이후 예정)
- 크로스 상품 혼합 학습 (A1 + A2 혼합 등)
