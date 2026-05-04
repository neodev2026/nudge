# Task: Marathon Mode 구현

**이슈 ID**: NUDGE-042
**타입**: Feature
**우선순위**: P1
**Story Points**: 13
**작성일**: 2026-04-23
**최종 업데이트**: 2026-04-23 (v3)
**상태**: Ready for Development

---

## Summary

상품 내 전체 학습 스테이지(단어)를 연속 스트림으로 보고, 미니 퀴즈(5개마다) / 복습 퀴즈(50개마다) / 전체 퀴즈(완주 시)로 기억을 확인하는 집중 학습 도구를 구현한다. 전체 퀴즈 결과만 DB에 저장하며, 완주 기록은 회차별 × 스테이지별 추이 테이블로 확인할 수 있다.

---

## Background

PRD: `marathon-mode-prd.md` v2 참조
설계 문서: `nudge-v2-design-*.md` §24 (구현 후 추가 예정)

---

## Acceptance Criteria

- [ ] **AC-01** `session-choice-page`에서 "마라톤 모드 →" 선택 시 `/products/:slug/marathon`으로 이동한다
- [ ] **AC-02** 모든 learning stage 카드가 `display_order` 순서대로 스테이지 단위로 끊김 없이 표시된다
- [ ] **AC-03** 발음 듣기 버튼이 있는 카드 진입 시 TTS가 자동으로 2회 재생된다
- [ ] **AC-04** 5개 스테이지마다 미니 퀴즈 5문항이 출제된다 (방금 본 5개 스테이지 대상)
- [ ] **AC-05** 50번째 스테이지 완료 시 미니 퀴즈 대신 복습 퀴즈 50문항이 출제된다
- [ ] **AC-06** "이전 내용 포함" 체크 ON 시 복습 퀴즈가 처음부터 현재까지 누적 범위로 출제된다
- [ ] **AC-07** 미니/복습/전체 퀴즈 모두 `word_to_meaning`과 `meaning_to_word`가 혼합 출제된다
- [ ] **AC-08** 미니 퀴즈 및 복습 퀴즈 결과는 DB에 저장되지 않는다
- [ ] **AC-09** 중단 후 재접속 시 `last_stage_index` 위치의 스테이지부터 스트림이 재개된다
- [ ] **AC-10** 전체 퀴즈 완료 시 `nv2_marathon_runs`에 `completed` 상태로 저장된다
- [ ] **AC-11** 전체 퀴즈의 모든 문항 정오가 `nv2_marathon_answers`에 `stage_id` 기준으로 저장된다
- [ ] **AC-12** 완주 결과 화면에서 회차(column) × 스테이지(row) 정오 추이 테이블이 표시된다
- [ ] **AC-13** "전체 출력" 버튼 클릭 시 상품 전체 카드가 A4 프린트 시트로 출력된다

---

## Definition of Done

- [ ] 모든 AC 통과
- [ ] Test Plan TC-MM-01 ~ TC-MM-16 전항목 통과
- [ ] DB 스키마: `schema.ts` → `db:generate` → `db:migrate` 완료
- [ ] 신규 라우트 `routes.ts` 등록 완료 (파일 생성 전에 등록하면 ENOENT 발생 — 파일 먼저)
- [ ] 익명 사용자 진입 시 로그인 유도 확인
- [ ] `nudge-v2-design-*.md` 설계 문서 §24 업데이트 완료
- [ ] 커밋 메시지 작성 완료

---

## Technical Notes (Claude Code 전달용)

### 신규 파일 구조

```
app/features/v2/marathon/
├── screens/
│   ├── marathon-page.tsx          # /products/:slug/marathon — 진입/이어하기 선택
│   ├── marathon-stream-page.tsx   # 카드 스트림 + 미니/복습 퀴즈
│   ├── marathon-result-page.tsx   # 완주 결과 + 점수/시간 추이 테이블
│   └── marathon-print-page.tsx    # /products/:slug/marathon/print — 전체 출력
└── lib/
    └── queries.server.ts          # marathon DB 쿼리
app/features/v2/marathon/api/
├── start.tsx                      # POST /api/v2/marathon/:productSlug/start
├── save-progress.tsx              # POST /api/v2/marathon/:runId/save-progress
└── complete.tsx                   # POST /api/v2/marathon/:runId/complete
```

### 수정 파일

```
app/features/v2/session/screens/session-choice-page.tsx  # 세 번째 옵션 추가
app/routes.ts                                             # marathon 라우트 4개 등록
db/schema.ts                                              # 테이블 2개 추가
```

### DB 스키마

```typescript
// nv2_marathon_runs
export const nv2MarathonRuns = pgTable('nv2_marathon_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  auth_user_id: text('auth_user_id').notNull(),
  product_id: uuid('product_id').notNull(),
  run_number: integer('run_number').notNull(),
  status: text('status').notNull().default('in_progress'), // in_progress | completed
  score: integer('score'),
  total_questions: integer('total_questions'),
  last_stage_index: integer('last_stage_index').notNull().default(0), // 0-based
  elapsed_seconds: integer('elapsed_seconds'),
  started_at: timestamp('started_at', { withTimezone: true }).defaultNow(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
});

// nv2_marathon_answers — 전체 퀴즈 결과만 저장
export const nv2MarathonAnswers = pgTable('nv2_marathon_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  run_id: uuid('run_id').notNull(),
  stage_id: uuid('stage_id').notNull(),
  question_direction: text('question_direction').notNull(), // word_to_meaning | meaning_to_word
  is_correct: boolean('is_correct').notNull(),
  answered_at: timestamp('answered_at', { withTimezone: true }).defaultNow(),
});
```

### 카드 로딩 쿼리

```
nv2_learning_products (slug)
→ nv2_product_sessions
→ nv2_product_session_stages (display_order ASC)
→ nv2_stages (stage_type = 'learning')
→ nv2_cards (해당 stage의 카드 전부, 등록 순서대로)
```

전체 카드를 loader에서 한 번에 로딩 → 클라이언트 상태(useState)로 관리.

### 퀴즈 분기 로직

`completedCount`: 지금까지 완료한 스테이지 수 (1-based 카운트)

```
completedCount % 50 === 0 → 복습 퀴즈
  범위(includeAll 설정에 따라):
    false: stages[completedCount - 50 .. completedCount - 1]  (50문항)
    true:  stages[0 .. completedCount - 1]                   (completedCount 문항)
completedCount % 5 === 0 (50 배수 제외) → 미니 퀴즈 (5문항)
  대상: stages[completedCount - 5 .. completedCount - 1]
그 외 → 퀴즈 없음, 다음 스테이지로
```

### 오답 보기 생성

- 정답 stage를 제외한 같은 product 내 stages에서 무작위 3개 추출
- `word_to_meaning`: 보기 = 한국어 의미 (title card의 back)
- `meaning_to_word`: 보기 = 대상 언어 단어 (title card의 front)

### 이어하기 / 처음부터 로직

```
진입 시 nv2_marathon_runs 조회:
  WHERE auth_user_id = ? AND product_id = ? AND status = 'in_progress'

[이어하기 선택]
  in_progress run 있음 → last_stage_index 위치에서 재개

[처음부터 선택]
  in_progress run 있음 → UPDATE (last_stage_index=0, started_at=now,
                           score=null, total_questions=null,
                           elapsed_seconds=null, completed_at=null)
  in_progress run 없음 → 신규 run INSERT
    run_number = (same product completed count + 1)
```

### 주의사항

- DB 스키마 변경: `schema.ts` 수정 → `npm run db:generate` → `npm run db:migrate` 순서 필수
- `routes.ts` 등록은 파일 생성 후 진행 (미리 등록하면 React Router 7 ENOENT 에러)
- 익명 사용자(`auth_user_id.startsWith('anon:')`) → `/login?next=/products/:slug/marathon` 리디렉트
- 미니/복습 퀴즈는 클라이언트 상태로만 처리, API 호출 없음
- save-progress API는 스테이지 완료마다 호출 (debounce 불필요, 단순 upsert)
