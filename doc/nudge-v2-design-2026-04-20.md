# Nudge v2 설계 문서

**작성일**: 2026-03-23  
**최종 업데이트**: 2026-05-01 (v14)  
**상태**: Vercel 배포 완료. Deutsch A1·A2·B1 / 히라가나 / 카타카나 / Spanish A1·A2·B1·B2 콘텐츠 등록 완료. Leni AI 채팅 + dictation/writing 스테이지 구현 완료. 이메일/Google/Discord 회원가입·로그인 구현 완료. 상품 구매 및 무료 체험 플로우 구현 완료. 이메일 학습 알림 구현 완료. 어드민 통계 대시보드 구현 완료. 복습 UX 보완 완료. Story Learning 구현 완료. Leni Cheer DM v2 구현 완료 (n8n 이관). 마라톤 모드 구현 완료 (TTS 시퀀스 재생, 미니/복습/최종 퀴즈, 스테이지 점프). **마라톤 nudge DM 구현 완료** (카드 커서 기반 미리보기, run_id 보안 토큰 resume 링크, 로그인 없이 진행 저장). 클로즈 베타 테스트 진행 중 (7명).

---

## 1. v2 개요

### v1과의 차이

| 항목 | v1 | v2 |
|---|---|---|
| 사용자 식별 | Supabase auth.users | auth_user_id (Supabase auth.users UUID) 단일 키 |
| 회원가입 | 필수 | 이메일 / Google / Discord OAuth |
| 자동화 | n8n | Supabase Cron + 서비스 API |
| 학습 단위 | learning_card 개별 발송 | session 링크 1회 발송 |
| 피드백 방식 | 1~10점 점수 | self 평가 (학습완료 / 다시보기) |
| 테이블 | v1 테이블 그대로 유지 | nv2_ prefix 신규 테이블 |

### 핵심 철학
- 알림 하나로 학습을 시작한다
- 세션 단위로 DM/이메일 1회 발송, 사용자 페이스에 맞춰 진행
- 로그인 없이도 무료 체험 가능

---

## 2. 기술 스택

- **프레임워크**: Remix (React Router 7)
- **DB**: Supabase PostgreSQL + Drizzle ORM
- **UI**: Shadcn/ui + Tailwind CSS
- **자동화**: Supabase Cron → 서비스 API 호출
- **콘텐츠 생성**: n8n + OpenAI → Supabase Postgres 직접 INSERT
- **SNS 발송**: Discord Bot API (구현 완료), 추후 KakaoTalk / Telegram
- **이메일 발송**: Resend SMTP (`mail.neowithai.com` 도메인 인증 완료, 발신자 `nudge@mail.neowithai.com`)
- **인증**: Supabase Auth (이메일+비밀번호 / Google OAuth / Discord OAuth)
- **배포**: Vercel (main 브랜치 자동 배포) + Cloudflare DNS

---

## 3. 사용자 온보딩 및 학습 흐름

```
랜딩 페이지 방문 (/)
→ 네비게이션 바: 로그인 / 회원가입 버튼
→ /join 또는 /login (이메일, Google OAuth, Discord OAuth 지원)
  → Google OAuth: /auth/google/start → /auth/google/callback
  → Discord OAuth: /auth/discord/start → /auth/discord/start-oauth → /auth/discord/callback
  → 이메일: Supabase signUp → 이메일 인증 → 로그인
  → 로그인/가입 성공 → ?next= 파라미터 URL로 복귀 (없으면 /products)

상품 선택 → /products/:slug
→ 비로그인: "로그인하고 학습 시작 →" 버튼 → /login?next=/products/:slug
→ 로그인 + 미구매: "구매하고 학습 시작 →" 버튼 → /products/:slug/checkout
→ 로그인 + 구매 완료: "학습 시작 →" 버튼
  → start-learning API → /sessions/:id (학습 방법 선택 페이지)
→ 즉시 무료 체험: 모달 표시 → trial API → 익명 세션 생성 → /sessions/:id

/products/:slug/checkout
→ 상품 정보 + 가격 표시
→ 0원 상품: "무료로 시작하기" 버튼 → purchase API → /products/:slug
→ 유료 상품: "결제 준비 중" 안내 (추후 Stripe / 토스페이먼츠)

/sessions/:sessionId  (학습 방법 선택 페이지)
→ "학습 목록" → /sessions/:sessionId/list
  → stage 목록 표시 (순서, 완료 여부)
  → 각 stage 클릭 → /stages/:stageId        (learning)
                   → /quiz/:stageId          (quiz_*)
                   → /sentence/:stageId      (sentence_practice)
                   → /dictation/:stageId     (dictation)
                   → /writing/:stageId       (writing)
  → 모든 stage 완료 시 자동으로 session complete API 호출
    → 일반 사용자: 다음 세션 생성 + "지금 바로 다음 세션" 버튼
    → 익명 사용자: "회원가입하고 계속 학습하기" 버튼 표시
→ "Leni와 학습" → /sessions/:sessionId/chat
  → 익명 사용자: 초기 카드 소개 체험 가능 (OpenAI 호출 없음)
  → 사용자가 첫 메시지 입력 시 → 안내 메시지 반환 (OpenAI 호출 차단)

SNS DM 링크 클릭 (로그인 불필요 — public access)
→ /sessions/:sessionId 이동 (학습 방법 선택 페이지)
```

### 인증 방식별 DM/알림 발송

| 인증 방식 | 알림 채널 |
|---|---|
| Discord OAuth | Discord DM ✅ |
| Google / 이메일 | 이메일 (Resend) ✅ |

### SNS 채널 지원 계획

| 채널 | 구현 시점 | 인증 방식 |
|---|---|---|
| Discord | MVP ✅ | Supabase 내장 OAuth |
| Email | ✅ 구현 완료 | Resend SMTP |
| KakaoTalk | 추후 | 별도 구현 |
| Telegram | 추후 | Telegram Login Widget + Admin API |

### 학습 상품 목록

| 슬러그 | 이름 | 언어 | 레벨 | 세션 수 | 단어 수 | 상태 |
|---|---|---|---|---|---|---|
| `deutsch-a1` | Deutsch A1 | 독일어 | A1 | 125 | 625 | ✅ 운영 중 |
| `deutsch-a2` | Deutsch A2 | 독일어 | A2 | 110 | 547 | ✅ 운영 중 |
| `deutsch-b1` | Deutsch B1 | 독일어 | B1 | 232 | 1160 | ✅ 운영 중 |
| `japanese-hiragana` | 히라가나 마스터 | 일본어 | A1 | 10 | 50 | ✅ 운영 중 |
| `japanese-katakana` | 카타카나 마스터 | 일본어 | A1 | 10 | 50 | ✅ 운영 중 |
| `spanish-a1` | Spanish A1 | 스페인어 | A1 | 79 | 396 | ✅ 운영 중 |
| `spanish-a2` | Spanish A2 | 스페인어 | A2 | 122 | 611 | ✅ 운영 중 |
| `spanish-b1` | Spanish B1 | 스페인어 | B1 | 131 | 659 | ✅ 운영 중 |
| `spanish-b2` | Spanish B2 | 스페인어 | B2 | 133 | 667 | ✅ 운영 중 |
| `story-deutsch-b1-snowwhite` | 스노우 화이트: 7개의 그림자 × 독일어 B1 | 독일어 | B1 | 20 (시즌 1) | — | ✅ 운영 중 |

---

## 4. 세션 구조

### Session = learning stage N개 + quiz + sentence_practice stage

```
홀수 세션: learning×5 + quiz_current_session + sentence_practice           (7 stages)
짝수 세션: learning×5 + quiz_current_session + sentence_practice + quiz_current_and_prev_session (8 stages)
```

- 하루에 여러 세션 진행 가능 (사용자 페이스)
- 세션 단위로 DM 1회 발송
- session_kind: `new` (신규 학습) / `review` (복습)
- review_round: 복습 회차 (1~4), 신규 학습이면 null

### 세션 학습 방법 선택 페이지 (`/sessions/:sessionId`)

```
[헤더] 뒤로가기 버튼 + 상품명 · Session N + 세션 제목

[복습 배너] session_kind === "review"일 때만 표시
  - "🔁 복습 N회차" + "반복이 기억을 만들어요 💪" 안내

[본문] 세 개의 배너 (모바일 기준 세로 스택)

[배너 A: 학습 목록]
  - 배지: "자기주도"
  - 설명: 신규 / 복습에 따라 문구 분기
  - 버튼: "학습 목록으로 →" / "복습 목록으로 →" → /sessions/:sessionId/list

[배너 B: Leni와 학습]
  - 배지: "AI 튜터"
  - 설명: 신규 / 복습에 따라 문구 분기
  - 턴 잔여: 월정기권 N턴 | 충전권 N턴
  - 버튼: "Leni와 학습 시작 →" / "Leni와 복습 시작 →" → /sessions/:sessionId/chat

[배너 C: 마라톤 모드] productSlug가 있을 때만 표시
  - 배지: "전체 연속 학습"
  - 설명: "전체 단어를 처음부터 끝까지 한 번에 학습, 5개마다 미니 퀴즈, 50개마다 복습 퀴즈"
  - 버튼: "마라톤 모드 →" → /products/:slug/marathon
```

### 세션 목록 페이지 UI 구조 (`/sessions/:sessionId/list`)

```
[헤더] 뒤로가기 + Session N + 세션 제목
  - 복습 세션: "🔁 복습 N회차" 인디고 배지 표시

[상단] Leni 이미지 + 안내 문구
  신규 세션:
    - 완료 전: "아래의 모든 학습을 완료하세요!"
    - 완료 후: "모든 학습을 완료하셨네요! 🎉"
  복습 세션:
    - 완료 전: "복습할 카드를 다시 학습해보세요! 반복이 기억을 만들어요 💪"
    - 완료 후: "복습 완료! 기억력이 점점 강해지고 있어요 🧠"

[중간] 퀴즈 건너뛰기 버튼 (조건부)
  - 노출 조건: learning stage 전체 완료 + quiz/sentence stage 미완료
  - 신규: "퀴즈 건너뛰고 다음 세션으로 →"
  - 복습: "퀴즈 건너뛰고 복습 완료 →"

[하단] Stage 목록
  신규 세션:
    - 완료: 초록 배경 + ✓ 아이콘
    - 현재: 네이비 강조
    - 미도달: 흐린 표시
  복습 세션:
    - 복습 완료: 인디고 배경 + ✓ 아이콘 + "복습 완료" 레이블
    - 복습 필요: 앰버 배경 + ↺ 아이콘 + "복습 필요" 레이블
    - 현재: 네이비 강조
```

### 복습 세션 완료 판정 규칙

```
신규 세션: completed = !!progress.completed_at
복습 세션: completed = last_review_completed_at > session.created_at (ms 비교)
```

- `completeNv2Stage()`: `completed_at`이 이미 있는 경우 `last_review_completed_at = now` 업데이트
- Supabase JS v2에서 `.update({ field: null })`은 null을 무시하므로, 초기화 시 epoch sentinel(`1970-01-01T00:00:00.000Z`) 사용
- `session_status === "completed"` 가드: 페이지 로드 시 자동 완료 중복 방지

### 학습 시작 진입점

| 진입점 | 동작 |
|---|---|
| 상품 페이지 "학습 시작" (구매 완료) | start-learning API → `/sessions/:id` |
| 상품 페이지 "즉시 무료 체험" | trial API → 익명 세션 생성 → `/sessions/:id` |
| SNS DM 링크 | `/sessions/:sessionId` 바로 이동 (로그인 불필요) |

---

## 5. DB 스키마 개요

### 주요 테이블

| 테이블 | 용도 |
|---|---|
| `nv2_learning_products` | 학습 상품 (name, slug, category, meta, price, total_stages) |
| `nv2_product_sessions` | 상품 세션 정의 (session_number, title) |
| `nv2_product_session_stages` | 세션 ↔ 스테이지 조인 (display_order) |
| `nv2_stages` | 스테이지 (stage_type, title) |
| `nv2_cards` | 카드 (card_type, card_data) |
| `nv2_sessions` | 사용자 세션 (auth_user_id, session_kind, status) |
| `nv2_stage_progress` | 카드별 학습 진도 (completed_at, last_review_completed_at, review_status) |
| `nv2_subscriptions` | 구독 정보 (auth_user_id, product_id, source, is_active) |
| `nv2_profiles` | 사용자 프로필 (auth_user_id, display_name, email, discord_id, timezone) |
| `nv2_schedules` | DM 발송 큐 (auth_user_id, schedule_type, scheduled_at, status) |
| `nv2_quiz_results` | 퀴즈 점수/랭킹 |
| `nv2_chat_turns` | Leni AI 채팅 이력 |
| `nv2_turn_balance` | AI 채팅 턴 잔여량 |
| `nv2_site_settings` | 점검 모드 등 사이트 설정 |

---

## 6. 인증 시스템

### 로그인/회원가입 페이지

| 라우트 | 설명 |
|---|---|
| `GET /login` | 이메일+비밀번호 로그인 + Google/Discord OAuth 버튼 |
| `GET /join` | 이메일+비밀번호 회원가입 + Google/Discord OAuth 버튼 |
| `GET /auth/google/start` | Google OAuth 시작 (prompt=select_account) |
| `GET /auth/google/callback` | Google OAuth 콜백 → nv2_profiles upsert + 신규 사용자 welcome 이메일 발송 |
| `GET /auth/discord/start` | Discord OAuth 시작 (timezone 수집) |
| `GET /auth/discord/callback` | Discord OAuth 콜백 → nv2_profiles upsert + guild 참여 |
| `GET /auth/logout` | 로그아웃 → / 이동 |
| `GET /account` | 계정 설정 (프로필, 연결 계정, 회원 탈퇴) |

### Google OAuth 운영 이슈

- **Supabase Site URL**: `https://nudge.neowithai.com` 으로 설정 필수 (`localhost`로 두면 운영 환경에서 OAuth 콜백 실패)
- **Vercel 환경변수**: `SITE_URL=https://nudge.neowithai.com` 설정 필수 (`google-start.tsx`의 `redirectTo` 구성에 사용)

---

## 7. 이메일 학습 알림

### 채널 결정 로직 (dispatch.tsx)

```
discord_id 있음 + discord_dm_unsubscribed = false → Discord Bot DM
discord_id 없음 + email 있음 + email_unsubscribed = false → Resend 이메일
cheer 타입 + discord_id 없음 → skip (cheer는 Discord 전용)
그 외 → failed
```

### 이메일 함수 (`email.server.ts`)

| 함수 | 발송 시점 |
|---|---|
| `sendWelcomeEmail` | Google OAuth 신규 가입 직후 (google-callback.tsx) |
| `sendSessionEmail` | Cron dispatch — 새 세션 / 복습 세션 알림 |
| `sendMarathonNudgeEmail` | Cron dispatch — marathon_nudge 스케줄 발송 (카드 front/back 미리보기 포함) |

- 발신자: `Nudge <nudge@mail.neowithai.com>`
- 인증 도메인: `mail.neowithai.com`
- cheer 이메일 미구현 (Discord 전용)

---

## 8. 무료 체험 (익명 세션)

### 플로우

```
상품 상세 페이지 "즉시 무료 체험" 클릭
→ TrialModal 표시 ("학습 기록 저장 안 됨" 안내)
→ POST /api/v2/products/:slug/trial
  → nv2_sessions INSERT (auth_user_id = 'anon:<uuid>')
  → { ok: true, session_id }
→ /sessions/:session_id 이동
```

### 익명 세션 제약

| 상황 | 동작 |
|---|---|
| 세션 완료 | 다음 세션 생성 skip, 복습 스케줄 생성 skip |
| 세션 완료 UI | "회원가입하고 계속 학습하기" 버튼 표시 |
| Leni 채팅 초기 카드 | 정상 표시 (OpenAI 호출 없음) |
| Leni 채팅 메시지 입력 | OpenAI 호출 차단, 안내 메시지 반환 |

### 자동 정리

- `cron/daily-reset`: 생성 후 7일(`ANON_SESSION_RETENTION_DAYS`) 경과 시 자동 삭제

---

## 9. 회원 탈퇴

### 삭제 순서 (FK 의존성 순)

```
1. nv2_chat_turns
2. nv2_turn_balance
3. nv2_schedules
4. nv2_quiz_results
5. nv2_stage_progress
6. nv2_sessions
7. nv2_subscriptions
8. nv2_profiles
9. auth.users (Supabase admin API)
```

---

## 10. Leni AI 채팅

### 세션 유형별 시스템 프롬프트

**신규 세션 (`buildNewSessionPrompt`)**
```
1단계: 카드 전시 (bubbles에 전체 카드)
2단계: 사용자 요약 대기
3단계: 요약 입력 시 complete_stages=true
4단계: 퀴즈 전시
5단계+: 실전 대화
```

**복습 세션 (`buildReviewSessionPrompt`) — 인출 연습 기반**
```
1단계: 단어만 나열 (카드 미표시) → 기억 유도 (인출 테스트)
2단계: 사용자 답변 평가
  - 맞힌 단어: 칭찬
  - 틀린/모르는 단어: 해당 카드 버블로 보강
  - complete_stages=true
3단계: 퀴즈 전시
4단계: 틀린 단어 위주 약점 집중 실전 대화
```

### getLeniResponse 시그니처

```typescript
getLeniResponse(
  user_message, history, cards, quiz_stages,
  display_name, session_title, product_category,
  session_kind: "new" | "review" = "new",
  review_round: number | null = null
)
```

---

## 11. 어드민

### 어드민 페이지 구조

| 라우트 | 설명 |
|---|---|
| `GET /admin` | 대시보드 (통계 개요) |
| `GET /admin/products` | 상품 관리 (목록 + 추가) |
| `GET /admin/users` | 사용자 관리 |
| `GET /admin/trial-sessions` | 익명 체험 세션 관리 |
| `GET /admin/leni-turns` | Leni 채팅 턴 관리 |
| `GET /admin/site-settings` | 사이트 설정 (점검 모드) |

### 어드민 통계 대시보드 (`/admin`)

**날짜 + 타임존 선택 지원**
- URL 파라미터: `?date=YYYY-MM-DD&tz=IANA`
- 기본값: 오늘, Asia/Seoul
- DST 반영 UTC 변환: `localDateToUtcRange(date_str, timezone)`

**섹션 구성**
1. KPI 카드 4종: 신규 가입자 / 활성 세션 / 완료 세션 / 알림 발송
2. 최근 7일 추이 바 차트 (순수 SVG, 외부 라이브러리 없음)
3. 상품별 현황 테이블 (구독자 / 활성 세션 / 당일 완료)
4. 최근 가입자 10명 (채널 배지 포함)

**타임존 옵션**: 서울(KST) / 도쿄(JST) / 베를린(CET) / 런던(GMT) / 뉴욕(EST) / UTC

---

## 12. Cron 자동화

### Job 구성 (5개)

| Job | 주기 | 역할 |
|---|---|---|
| `daily-reset` | 30분 | 자정 코호트 today_new_count / today_review_count 초기화 |
| `enqueue-daily` | 30분 | send_hour 코호트 DM 큐 생성 |
| ~~`enqueue-nudge`~~ | ~~30분~~ | ~~미완료 세션 cheer DM 큐 생성~~ → **n8n 이관 (deprecated)** |
| `dispatch` | 5분 | pending 스케줄 발송 (Discord DM / 이메일) |
| `marathon-nudge` | 30분 | 마라톤 진행 중 사용자에게 카드 미리보기 nudge DM 발송 |

### marathon-nudge 크론 상세

- **엔드포인트**: `POST /api/v2/cron/marathon-nudge`
- **대상**: `nv2_marathon_runs.status = 'in_progress'` AND `last_stage_index > 0` 인 런
- **발송 조건**: 구독 활성 상태 + 발송 윈도우 내 + 동일 윈도우 중복 없음

**발송 윈도우** (사용자 로컬 타임 기준, profile.timezone):

| 슬롯 | 허용 범위 |
|---|---|
| 06:00 | 05:45 ~ 06:15 |
| 09:00 | 08:45 ~ 09:15 |
| 12:00 | 11:45 ~ 12:15 |
| 15:00 | 14:45 ~ 15:15 |
| 18:00 | 17:45 ~ 18:15 |
| 21:00 | 20:45 ~ 21:15 |

**nudge_card_cursor**: 런별로 마지막으로 미리보기한 카드 위치(0-based 전역 인덱스)를 추적. 매 발송마다 +1 전진.

**cursor sync**: 사용자가 마라톤을 진행하여 cursor가 실제 진행보다 뒤처진 경우 `firstCardIndexOfStage(last_stage_index + 1, counts)`로 fast-forward.

**message_body 포맷**: `marathon:{slug}|{lastStageIndex}|{cursor}|{front}|{back}`

**DM 내용**: 카드 front/back 임베드 미리보기 + "이어하기 →" 버튼

**resume URL**: `/products/:slug/marathon/:runId/resume` (run_id가 URL에 포함되어 로그인 없이 진행 저장 가능)

### DM 발송 원칙

- Cron(`enqueue-daily` / `dispatch` / `marathon-nudge`)만 DM/이메일 발송
- `start-learning`, `session/complete`에서 DM 발송 없음
- cheer DM은 Discord 전용 (이메일 fallback 없음)

### n8n 자동화 워크플로우 (leni-cheer-dm-v2)

cheer DM 큐 생성은 Supabase Cron에서 n8n으로 이관됨.

| 항목 | 값 |
|---|---|
| 파일 | `n8n/leni-cheer-dm-v2.json` |
| 실행 주기 | `0 */2 * * *` (2시간마다) |
| 발송 슬롯 | 09:00 KST, 19:00 KST |
| DB 연결 | Postgres 직접 연결 (`supabase-nudge-n8n_worker` credential) |

**노드 구성 (13개)**:
```
Schedule Trigger
→ Get Incomplete Sessions (Postgres)
→ Filter and Dedup Users
→ Loop Over Users
  → Prepare Queries
  → Dedup Check
  → Check Dedup Result
  → Get Completed Count + Get Content Preview (Postgres, 병렬)
  → Build Preview
  → Build OpenAI Prompt
  → Call OpenAI
  → Parse Response and Build Schedule
  → Insert nv2_schedules (Postgres)
```

**cheer DM message_body 포맷**:
```
cheer:HH|product_name|session_label|incomplete_message|||complete_message
```
- `cheer:HH`: 발송 시각(KST 시)
- `|||`: 미완료 메시지와 완료 메시지 구분자
- dispatch.tsx가 발송 직전 세션 상태를 재확인하여 어느 메시지를 보낼지 결정

**is_script 판별**: `product_slug`에 `'hiragana'` 또는 `'katakana'`가 포함되면 스크립트 상품으로 간주 (n8n 내 분기 처리).

### 복습 완료 DM 문구

```
🔁 {상품명} · Session N을 완료했어요! 기억력이 점점 강해지고 있어요 🧠
다음 복습 일정은 자동으로 예약됩니다. 수고하셨어요!
```

---

## 13. 테스트 도구

### 복습/학습 상태 초기화 API

`POST /api/v2/sessions/:sessionId/reset-progress`

- **활성화 조건**: `RESET_PROGRESS_ENABLED=true` 환경변수 필수
- `is_review=true`: `last_review_completed_at`을 epoch sentinel(`1970-01-01`)로 설정
- `is_review=false`: `nv2_stage_progress` rows 삭제
- 세션 status를 `in_progress`로 초기화

> ⚠️ 테스트 완료 후 `RESET_PROGRESS_ENABLED` 환경변수 삭제 권장

### 특정 스케줄 강제 발송

`POST /api/v2/cron/dispatch?schedule_id={id}`

- `Authorization: Bearer {CRON_SECRET}` 헤더 필수
- 해당 schedule row를 `status`, `scheduled_at`에 상관없이 즉시 발송
- 발송 후 status → `sent`로 업데이트
- n8n에서 insert된 cheer DM 로컬 테스트 용도

### 마라톤 nudge 단위 테스트

`npm run test` — vitest 기반, `tests/marathon-nudge.test.ts`

순수 함수 19개 테스트 커버:
- `getLocalTime`: UTC → 로컬 타임 변환, hour 24 → 0 정규화
- `isWithinSendWindow`: 6개 발송 슬롯 ±15분 판정
- `isSameWindow`: 날짜 교차 false positive 방지
- `buildMarathonMessageBody`: message_body 포맷 검증
- `needsCursorSync`: cursor vs lastStageIndex 비교

---

## 14. 파일 구조 (주요 변경 포함)

```
app/
├── features/
│   ├── admin/
│   │   ├── lib/
│   │   │   ├── queries.server.ts               ✅
│   │   │   └── stats-queries.server.ts         ✅ 통계 쿼리 (KPI/추이/상품별/가입자)
│   │   └── screens/
│   │       ├── dashboard.tsx                   ✅ /admin (통계 대시보드)
│   │       ├── products.tsx                    ✅ /admin/products
│   │       ├── users.tsx                       ✅ /admin/users
│   │       ├── trial-sessions.tsx              ✅ /admin/trial-sessions
│   │       ├── leni-turns.tsx                  ✅ /admin/leni-turns
│   │       └── site-settings.tsx               ✅ /admin/site-settings
│   └── v2/
│       ├── auth/
│       │   └── lib/
│       │       ├── discord.server.ts            ✅ sendSessionCompleteDm(is_review 파라미터 추가)
│       │       ├── email.server.ts              ✅ sendWelcomeEmail / sendSessionEmail
│       │       └── queries.server.ts            ✅
│       ├── stage/
│       │   └── lib/queries.server.ts            ✅ completeNv2Stage: 복습 시 last_review_completed_at 업데이트
│       ├── session/
│       │   ├── screens/
│       │   │   ├── session-choice-page.tsx      ✅ /sessions/:sessionId
│       │   │   ├── session-page.tsx             ✅ /sessions/:sessionId/list (story 챕터 요약 카드 포함)
│       │   │   └── story-session-page.tsx       ✅ /sessions/:sessionId/story (phase 기반 흐름 제어)
│       │   └── api/
│       │       ├── complete.tsx                 ✅ POST /api/v2/sessions/:sessionId/complete
│       │       └── reset-progress.tsx           ✅ POST /api/v2/sessions/:sessionId/reset-progress
│       ├── story/
│       │   ├── screens/
│       │   │   └── story-page.tsx               ✅ /story/:stageId (문장 단위 reveal UX)
│       │   └── api/
│       │       └── result.tsx                   ✅ POST /api/v2/story/:stageId/result
│       ├── products/
│       │   └── screens/
│       │       ├── my-learning-page.tsx         ✅ /my-learning (구독 상품 진행 현황)
│       │       └── progress-page.tsx            ✅ /products/:slug/progress (상품별 진도)
│       ├── marathon/
│       │   ├── screens/
│       │   │   ├── marathon-page.tsx            ✅ /products/:slug/marathon (클라이언트 상태머신, TTS, 퀴즈)
│       │   │   ├── marathon-resume-page.tsx     ✅ /products/:slug/marathon/:runId/resume (DM 링크 진입, auth 불필요)
│       │   │   ├── marathon-result-page.tsx     ✅ /products/:slug/marathon/result/:runId
│       │   │   └── marathon-print-page.tsx      ✅ /products/:slug/marathon/print
│       │   ├── api/
│       │   │   ├── start.tsx                    ✅ POST /api/v2/marathon/:slug/start
│       │   │   ├── save-progress.tsx            ✅ POST /api/v2/marathon/:runId/save-progress (runId로 인증, auth 불필요)
│       │   │   └── complete.tsx                 ✅ POST /api/v2/marathon/:runId/complete (runId로 인증, auth 불필요)
│       │   ├── lib/queries.server.ts            ✅ getMarathonProduct/Stages/Runs + stageCardCountsFromStages/firstCardIndexOfStage/getCardAtCursor
│       │   └── schema.ts                        ✅ nv2_marathon_runs (nudge_card_cursor 추가), nv2_marathon_answers
│       ├── cron/
│       │   ├── api/
│       │   │   ├── dispatch.tsx                 ✅ Discord DM / 이메일 채널 분기, ?schedule_id 강제 발송, cheer/marathon_nudge 처리
│       │   │   └── marathon-nudge.tsx           ✅ POST /api/v2/cron/marathon-nudge (발송 윈도우, cursor 관리, schedule enqueue)
│       │   └── lib/queries.server.ts            ✅ getLastMarathonNudge 추가
│       └── chat/
│           ├── screens/chat-page.tsx            ✅ story 말풍선 추가 (챕터 읽기 → 새 탭)
│           └── lib/leni.server.ts               ✅ 신규/복습 시스템 프롬프트 분리
```

---

## 15. 마라톤 모드

### 개요

전체 학습 단어를 처음부터 끝까지 연속으로 학습하는 모드. 세션 단위 학습과 별개로 `/products/:slug/marathon`에서 직접 진입. 코드는 모두 `marathon-page.tsx` 단일 파일의 클라이언트 사이드 상태 머신으로 구현.

### Phase 상태 머신

```
entry
  → (시작 / 재개 / 스테이지 점프)
  → stream          ← 카드 하나씩 표시 + TTS 자동 재생
      ↓ 스테이지 5개마다 (skip_mini_quiz=false)
  → mini_quiz       ← 직전 5스테이지 5문항
      ↓ (50의 배수 스테이지에서 mini_quiz 완료 후)
  → review_quiz     ← 직전 50스테이지 또는 누적 N문항
      ↓ 퀴즈 완료
  → stream          (복귀)
      ↓ 전체 완주
  → final_quiz      ← 전체 단어 퀴즈 (DB 저장)
      ↓
  → complete        → /products/:slug/marathon/result/:runId
```

**50 스테이지 경계 처리**: mini_quiz의 `follow_up_review` 필드로 미니 퀴즈 완료 후 복습 퀴즈를 연결. 미니 퀴즈를 건너뛰지 않고 mini → review 순서 보장.

### 진입점 (EntryView)

```
[이어하기]          진행 중인 런이 있을 때 → 저장된 last_stage_index부터 재개
[처음부터 시작]     새 런 생성 (기존 in_progress 런 초기화)
[마라톤 시작]       진행 중인 런이 없을 때 → 새 런 생성
[전체 퀴즈 바로 시작] 학습 없이 전체 final_quiz 즉시 시작
[스테이지 이동]     번호 입력 (1~N) → 해당 스테이지부터 새 런 시작
[전체 출력]        /products/:slug/marathon/print (새 탭)
```

### StreamView

```
[상단] 일시정지 버튼 | N / total_stages | ⚙️ 설정
[진행바] 전체 대비 현재 스테이지 비율 (초록 바)
[카드 영역]
  title 카드:   단어(front) + 의미(back) + 발음듣기 버튼
  description:  설명(back) + 다시듣기 버튼
  example:      예문(front) + 번역(back) + 발음듣기 버튼
  etymology:    어원(front) + 설명(back)
  image:        이미지(front) + 설명(back)
[다음 →]        자동 넘김 카운트다운 표시 (N)
[카드 N / M]    현재 스테이지 내 카드 위치
[퀴즈로 점프]    다음 50 스테이지 경계까지 건너뛰기 (조건부 표시)
```

### TTS 재생 방식

| 상황 | 재생 순서 | 비고 |
|---|---|---|
| title/example 카드 진입 | front → back → front → back | 타겟 언어 0.9x, 한국어 1.08x |
| description 카드 진입 | back → back | 한국어 1.08x |
| 발음듣기 버튼 (title/example) | front → back (1회씩) | |
| 다시듣기 버튼 (description) | back → back | |
| 퀴즈 정답 확인 시 | word (2회) | mini/review 퀴즈만 |

**TTS 구현**: `playTtsSequence(steps[], onDone)` — `_tts_gen` 세대 카운터로 React Strict Mode 이중 호출 및 카드 전환 시 stale 콜백 방지. `stopTts()`는 `_tts_gen`을 증가시켜 진행 중인 모든 TTS 콜백을 무효화.

### 설정 (localStorage 저장)

| 키 | 기본값 | 설명 |
|---|---|---|
| auto_advance | false | 자동 넘김 |
| auto_advance_delay | 3 | 자동 넘김 대기 시간 (초) |
| quiz_time_limit | false | 퀴즈 시간제한 |
| quiz_time_limit_seconds | 8 | 퀴즈 제한 시간 |
| skip_mini_quiz | false | 미니 퀴즈 건너뛰기 |
| skip_review_quiz | false | 복습 퀴즈 건너뛰기 |
| review_quiz_cumulative | false | 복습 퀴즈 누적 포함 |

### QuizView (미니/복습/최종 퀴즈 공용)

```
4지선다 — word_to_meaning 또는 meaning_to_word 랜덤
정답 확인 후:
  - 정답/오답 피드백 표시
  - tts_lang 있으면 단어 발음 2회 자동 재생 (mini/review만)
  - "다음 문제 →" 버튼 (3초 자동 넘김 토글)
하단:
  - 3초 후 자동 넘김 토글
  - "마지막 문제로 점프" (건너뛴 문제 오답 처리)
```

**퀴즈 레이블**: mini(`미니 퀴즈 · N개 완료`), review 비누적(`복습 퀴즈 · 51~100번`), review 누적(`복습 퀴즈 · 누적 100개`)

**key prop**: mini → review 전환 시 `key={phase.type + phase.completed_count}`로 QuizView 강제 재마운트 (내부 상태 초기화).

### API 엔드포인트

| 엔드포인트 | 인증 방식 | 설명 |
|---|---|---|
| `POST /api/v2/marathon/:slug/start` | auth.getUser() | 런 생성/재개/초기화. `{ restart: boolean }` |
| `POST /api/v2/marathon/:runId/save-progress` | runId UUID (auth 불필요) | `{ last_stage_index }` 중간 저장 |
| `POST /api/v2/marathon/:runId/complete` | runId UUID (auth 불필요) | 최종 퀴즈 결과 저장 (score, answers[]) |
| `POST /api/v2/cron/marathon-nudge` | CRON_SECRET | 마라톤 nudge 스케줄 생성 |

**save-progress / complete 인증**: `runId`(UUID v4)가 보안 토큰 역할 — `nv2_sessions.session_id`와 동일한 패턴. 메신저 인앱 브라우저에서 쿠키 없이도 저장 가능.

### DB 테이블

| 테이블 | 주요 컬럼 |
|---|---|
| `nv2_marathon_runs` | auth_user_id, product_id, run_number, status(in_progress/completed), last_stage_index, **nudge_card_cursor**, score, total_questions, elapsed_seconds |
| `nv2_marathon_answers` | run_id, stage_id, question_direction, is_correct |

- `nudge_card_cursor`: 런별 nudge DM 카드 커서 (0-based 전역 인덱스). 발송마다 +1 전진.
- `nv2_schedule_type` enum에 `marathon_nudge` 추가 (migration 0060).

모든 쿼리는 `product_id` 파라미터 기반 — 어떤 상품이든 동일 코드로 동작.

### card_data 구조 (`V2CardData`)

```typescript
{
  presentation: {
    front: string;  // 단어 / 이미지 URL / 질문
    back: string;   // 의미 / 답
    hint?: string;
  };
  details: { explanation, example_context?, visual_cue? };
  meta: { target_locale, learner_locale, logic_key };
}
```

nudge DM의 front/back은 `card_data.presentation.front` / `.back`에서 추출.

### DM resume 진입점 (`/products/:slug/marathon/:runId/resume`)

- **로더**: `runId`로 `nv2_marathon_runs` 조회 → `auth_user_id` 추출 (auth.getUser() 불필요)
- **컴포넌트**: `autoResume=true` 수신 시 진입 화면 건너뛰고 `last_stage_index`부터 즉시 스트림 시작
- **보안**: runId UUID(128-bit random)가 보안 토큰 — `nv2_sessions.session_id`와 동일한 패턴

### 결과 페이지 (`/products/:slug/marathon/result/:runId`)

완주 기록 목록: 런 번호, 점수, 정답률, 소요 시간.

### 출력 페이지 (`/products/:slug/marathon/print`)

전체 단어 A4 인쇄 시트: 번호 | 단어 | 의미(가림 가능) | 예문 | 쓰기 칸 ×3. 인증 불필요.

---

## 20. 코딩 컨벤션 및 패턴

1. **auth_user_id 단일 키**: 모든 nv2_ 테이블에서 사용자 식별은 `auth_user_id TEXT` (Supabase `auth.users.id`) 단일 컬럼. `sns_type`/`sns_id` 복합 키 폐기.
2. **DB 스키마 변경 규칙**: `schema.ts` 수정 → `npm run db:generate` → `npm run db:migrate` 순서 필수. Supabase SQL Editor 직접 실행 금지.
3. **SQL 함수 (trigger 등)**: drizzle-kit 범위 밖. `sql/functions/` 디렉토리에 파일 관리 + SQL Editor에서 직접 적용.
4. **Drizzle enum 인라인 정의**: `schema.ts`에서 `constants.ts` import로 enum 값을 받을 경우 drizzle-kit ZodError 발생. enum 값은 `schema.ts`에 직접 인라인으로 정의.
5. **uniqueIndex**: `onConflict` upsert 사용 시 반드시 `uniqueIndex`로 정의 (`index`만으로는 42P10 에러 발생).
6. **loader에서 ?next= 읽기**: `login.tsx`, `join.tsx`의 `?next=` 파라미터는 반드시 `loader`에서 서버 사이드로 읽어야 함. 클라이언트에서 `window.location.href`로 읽으면 SSR hydration 타이밍 이슈로 `/products` fallback 발생.
7. **인증 확인**: `client.auth.getUser()` 사용 필수. `client.auth.getSession()` 사용 금지 (보안 경고 발생).
8. **loader 패턴**: `useLoaderData<typeof loader>()` 사용. `Route.ComponentProps` destructuring 사용 금지 (`loaderData`가 `undefined`로 타입 추론됨).
9. **RLS casting**: PostgreSQL RLS 정책에서 enum 컬럼을 text와 비교 시 `::text` 명시적 캐스팅 필요.
10. **미사용 코드**: 삭제하지 않고 주석 처리. 특히 라우트.
11. **코드 코멘트**: 영어로 작성.
12. **커밋 메시지**: 영어로 작성.
13. **서버 전용 import**: loader/action 내부 동적 import로 클라이언트 번들 오염 방지.
14. **full file rewrite**: partial edit보다 전체 파일 재작성 방식. CRLF 처리: Python `rb` read + `\r\n` → `\n` 변환.
15. **익명 세션 판별**: `auth_user_id.startsWith('anon:')`.
16. **DM 발송 전담**: Cron(`enqueue-daily` / `dispatch`)만 DM 발송. `start-learning`, `session/complete`에서 DM 발송 없음.
17. **뷰포트 기준**: 학습 화면 → 모바일 기준(375px), 서비스/어드민 화면 → 데스크탑 기준.
18. **stage 완료 후 redirect**: `/sessions/:id/list`로 이동. `/sessions/:id` (choice 페이지) 아님.
19. **from_chat 지원**: `?from=chat` 파라미터 있으면 완료 후 `window.close()`.
20. **Supabase JS null update**: `.update({ field: null })`은 null을 무시함. NULL로 초기화하려면 epoch sentinel(`1970-01-01T00:00:00.000Z`) 또는 RPC 사용.
21. **instanceof Date 금지**: Supabase JS 반환 timestamp는 TypeScript 타입이 `string`으로 추론됨. `instanceof Date` 체크 대신 `String()` 또는 `new Date(String(val)).getTime()` 사용.
22. **복습 완료 판정**: `last_review_completed_at > session.created_at` (ms 정수 비교). `String()` 비교는 형식 불일치 위험 있음.
23. **story 상품 판별**: `product.meta.story` 필드 존재 여부로 판별 (`!!meta_obj?.story`). DB에 `meta.story` 값이 있으면 story 상품.
24. **story next=close**: Leni 채팅에서 새 탭으로 열린 story-page는 `?next=close`로 완료 후 `window.close()` 호출.
25. **nv2_product_sessions count**: 상품의 총 세션 수는 `total_stages / 5` 계산 대신 `nv2_product_sessions` 테이블 count 직접 조회.
26. **cheer DM message_body 포맷**: `cheer:HH|product_name|session_label|incomplete_message|||complete_message`. `|||`가 구분자로, dispatch.tsx가 발송 직전 세션 상태를 재확인하여 어느 메시지를 보낼지 결정. legacy 포맷(`cheer:HH|message`)도 지원.
27. **is_script 판별**: n8n 워크플로우에서 `product_slug`에 `'hiragana'` 또는 `'katakana'`가 포함되면 스크립트 상품으로 분기 처리 (cheer 메시지 생성 방식 차이).
28. **marathon_nudge message_body 포맷**: `marathon:{slug}|{lastStageIndex}|{cursor}|{front}|{back}`. dispatch.tsx가 파싱하여 DM/이메일 발송.
29. **runId 보안 토큰**: `nv2_marathon_runs.id`(UUID v4)를 DM resume URL에 포함. save-progress·complete API는 `auth.getUser()` 대신 runId만으로 인증. `nv2_sessions.session_id`와 동일한 패턴으로 메신저 인앱 브라우저 지원.
30. **marathon autoResume**: loader가 `autoResume: true`를 반환하면 컴포넌트는 초기 phase를 `"entry"` 대신 `"stream"`으로, `current_stage_idx`를 `last_stage_index`로 초기화하여 진입 화면 없이 즉시 학습 시작.

---

## 21. 알려진 이슈 및 결정 사항

| 날짜 | 내용 |
|---|---|
| 2026-03-27 | `nv2_profiles` insert RLS 누락 → 추가 완료 |
| 2026-03-27 | `Route.MetaFunction` 제네릭 미지원 → `matches` 패턴으로 통일 |
| 2026-03-27 | welcome stage → 상품별 오리엔테이션으로 변경 |
| 2026-03-27 | stage 단위 DM 발송 → session 단위 DM 발송으로 변경 |
| 2026-03-27 | `nv2_stage_progress` unique index 누락 → `uniqueIndex`로 수정 |
| 2026-03-28 | `nv2_sessions.session_id` bigserial → uuid 변경 (보안 토큰 역할) |
| 2026-03-28 | `nv2_subscriptions` 신규 추가 — link_access per subscription |
| 2026-03-28 | public access: stage/session/progress select RLS → public role로 변경 |
| 2026-03-28 | discord-callback: ?next= 파라미터로 원래 URL 복귀 지원 |
| 2026-03-31 | 세션 완료 버튼 제거 → useEffect 기반 자동 완료로 변경 |
| 2026-04-02 | TTS 루프 중지 버그: is_looping ref → 모듈 레벨 _tts_looping 변수로 변경 |
| 2026-04-04 | quiz_5 3단계 플로우 구현 (플래시카드→O/X→문장완성) |
| 2026-04-04 | session-page: 퀴즈 건너뛰기 버튼 추가 (learning 완료 시 노출) |
| 2026-04-05 | quiz_current_session / quiz_current_and_prev_session stage_type 추가 |
| 2026-04-05 | TTS 다국어 지원: TTS_LANG_MAP 도입 |
| 2026-04-05 | Discord Bot DM 이슈 해결 (guilds.join + addUserToGuild) |
| 2026-04-08 | Cron 4개 job 재설계 (daily-reset/enqueue-daily/enqueue-nudge/dispatch) |
| 2026-04-08 | Leni 캐릭터 확정: 15세 독일 소녀, 존댓말, 밝고 긍정적 |
| 2026-04-09 | n8n Parse & Build SQL 방어 코드 추가 |
| 2026-04-13 | Leni AI 채팅 구현 완료 (DB 스키마, bubbles[] 구조, 턴 관리) |
| 2026-04-13 | admin/users 사용자 관리 페이지 구현 완료 |
| 2026-04-13 | 세션 학습 방법 선택 페이지 구현 완료 |
| 2026-04-17 | auth_user_id 단일 키 전환: sns_type/sns_id 복합 키 완전 폐기 |
| 2026-04-17 | 이메일/Google OAuth 회원가입·로그인 구현 완료 |
| 2026-04-17 | 상품 구매 플로우 구현: checkout → purchase API → 구독 생성 |
| 2026-04-17 | 무료 체험(익명 세션) 구현: anon: prefix + 7일 자동 정리 |
| 2026-04-17 | nv2_subscriptions: source 컬럼 추가 (paid/free/admin) |
| 2026-04-17 | nv2_learning_products: price 컬럼 추가 |
| 2026-04-17 | DM 발송 Cron 전담으로 정리: start-learning/session-complete에서 제거 |
| 2026-04-17 | 회원 탈퇴 구현: 8개 테이블 순서대로 완전 삭제 |
| 2026-04-17 | /account 계정 설정 페이지 구현 |
| 2026-04-17 | /admin/trial-sessions 익명 세션 관리 페이지 구현 |
| 2026-04-17 | login.tsx/join.tsx: ?next= loader에서 서버 사이드 읽기로 수정 (SSR mismatch 해결) |
| 2026-04-17 | handle_sign_up() trigger: v1 profiles INSERT 제거, nv2_profiles INSERT만 유지 |
| 2026-04-17 | Drizzle enum 인라인 정의 규칙 확립 (constants.ts import 금지) |
| 2026-04-17 | nv2_subscriptions uniqueIndex 추가 (onConflict 42P10 오류 해결) |
| 2026-04-18 | Google OAuth 운영 환경 로그인 실패 → Supabase Site URL `localhost` → `nudge.neowithai.com` 변경으로 해결 |
| 2026-04-18 | 이메일 학습 알림 구현 완료 (email.server.ts, dispatch.tsx 채널 분기) |
| 2026-04-18 | 어드민 네비게이션 재구성: 대시보드/상품관리/Leni턴관리/사이트설정 분리 |
| 2026-04-18 | 어드민 통계 대시보드 구현 완료 (날짜·타임존 선택, SVG 차트) |
| 2026-04-18 | 복습 UX 보완 완료: 세션 선택/목록 페이지 복습 컨텍스트 표시 |
| 2026-04-18 | Leni 복습 시스템 프롬프트 구현: 인출 테스트 기반 복습 흐름 |
| 2026-04-18 | completeNv2Stage: 복습 시 last_review_completed_at 업데이트 추가 |
| 2026-04-18 | 복습 완료 판정: last_review_completed_at > session.created_at (ms 비교) |
| 2026-04-18 | Supabase JS null update 이슈 확인 → epoch sentinel 방식으로 해결 |
| 2026-04-18 | 테스트용 reset-progress API 추가 (RESET_PROGRESS_ENABLED=true 환경변수 필요) |
| 2026-04-22 | nv2_sessions 중복 세션 버그 수정: partial UNIQUE index 추가 (new/review 각각), createCronNewSession/createCronReviewSession/createNv2UserSession에서 error.code 23505 graceful handling |
| 2026-04-22 | n8n_worker RLS 추가: nv2_profiles (SELECT), nv2_product_sessions (SELECT), nv2_schedules (SELECT + INSERT) |
| 2026-04-22 | dispatch.tsx ?schedule_id 파라미터 추가 (강제 발송, status/scheduled_at 무관) |
| 2026-04-22 | Leni Cheer DM v2 구현 완료: n8n postgres 직접연결, OpenAI 개인화 메시지, |||  dual-message 포맷, is_script 분기 |

---

## 22. 미구현 항목 (우선순위 순)

| 순위 | 항목 | 비고 |
|---|---|---|
| 1 | **서비스 공개 런칭 준비** | 랜딩 페이지 정비, 베타 배너 제거 등 |
| 2 | **복습 UX 보완** | ✅ 완료 (2026-04-18) |
| 3 | **Story Learning** | ✅ 완료 (2026-04-20) — story-deutsch-b1-snowwhite 시즌 1 운영 중 |
| 3.5 | **Leni Cheer DM v2** | ✅ 완료 (2026-04-22) — n8n postgres 이관, OpenAI 개인화 메시지, dual-message 포맷 |
| 4 | **다국어 지원** | 로드맵 항목 |
| 5 | **결제 시스템** | Stripe 또는 토스페이먼츠 연동 (유료 상품 출시 시) |
| 6 | **SNS 연결 관리 화면** | /account에서 Discord/Telegram/KakaoTalk 연결 관리 |
| 7 | **세션 선택 페이지 Leni 이미지** | 학습 목록(집중/쿨톤), Leni채팅(대화/웜톤), 90×130px |
| 8 | **etymology/image 카드 생성** | n8n 워크플로우에 카드 타입 추가 |
| 9 | **카카오톡 / 텔레그램 지원** | 로드맵 항목 |
| 10 | **Story Learning 시즌 확장** | 시즌 2~12 (232세션 완성), 타 언어/이야기 추가 |
| 11 | **Story 삽화 관리** | 어드민에서 illustration_url 입력, 추후 DALL-E 자동 생성 |

---

## 23. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-03-23 | v2 설계 확정 및 스키마 작성 완료 |
| 2026-03-25 | 랜딩, 상품 목록, v2 레이아웃 구현 완료 |
| 2026-03-27 | Discord OAuth 온보딩 구현 완료 |
| 2026-03-27 | 핵심 학습 루프 E2E 테스트 완료 |
| 2026-03-28 | 어드민 전체 구현 완료 (로그인/상품/스테이지/카드/세션) |
| 2026-03-28 | Cron 자동화 구현 완료 |
| 2026-03-28 | 복습 스케줄 구현 완료 (r1→r2→r3→r4→mastered) |
| 2026-03-31 | public link access 구현 완료 (로그인 없이 학습 가능) |
| 2026-03-31 | Quiz 페이지 구현 완료 |
| 2026-04-02 | Vercel 배포 완료 (nudge.neowithai.com) |
| 2026-04-02 | n8n 카드 생성 워크플로우 구현 완료 |
| 2026-04-02 | Deutsch A1 콘텐츠 생성 완료 (125세션 × 5단어) |
| 2026-04-04 | sentence_practice / quiz_5 / quiz_10 구현 완료 |
| 2026-04-05 | quiz_current_session / quiz_current_and_prev_session 추가 |
| 2026-04-05 | TTS 다국어 지원 완료 |
| 2026-04-05 | 히라가나 상품 등록 완료 |
| 2026-04-06 | 카타카나 상품 등록 완료 |
| 2026-04-06 | 랜딩 페이지 v5 전면 개편 |
| 2026-04-08 | Cron 4개 job 구현 완료 |
| 2026-04-08 | 클로즈 베타 테스트 시작 (5명) |
| 2026-04-09 | 스페인어 A1/A2/B1/B2 콘텐츠 생성 완료 |
| 2026-04-13 | Leni AI 채팅 구현 완료 |
| 2026-04-13 | dictation / writing stage 구현 완료 |
| 2026-04-13 | 어드민 사용자 관리 페이지 구현 완료 |
| 2026-04-13 | 세션 학습 방법 선택 페이지 구현 완료 |
| 2026-04-13 | Deutsch A2 / B1 콘텐츠 등록 완료 |
| 2026-04-17 | auth_user_id 단일 키 전환 완료 (sns_type/sns_id 폐기) |
| 2026-04-17 | 이메일/Google OAuth 회원가입·로그인 구현 완료 |
| 2026-04-17 | 상품 구매 플로우 구현 완료 (checkout + purchase API) |
| 2026-04-17 | 무료 체험 익명 세션 구현 완료 |
| 2026-04-17 | 회원 탈퇴 구현 완료 (사용자 + 어드민) |
| 2026-04-17 | /account 계정 설정 페이지 구현 완료 |
| 2026-04-17 | /admin/trial-sessions 익명 세션 관리 구현 완료 |
| 2026-04-17 | 클로즈 베타 테스트 (7명) |
| 2026-04-18 | 이메일 학습 알림 구현 완료 (Google/이메일 사용자 대상 Resend 발송) |
| 2026-04-18 | Google OAuth 운영 환경 로그인 버그 수정 (Supabase Site URL 설정) |
| 2026-04-18 | 어드민 통계 대시보드 구현 완료 (날짜·타임존 선택, KPI·차트·상품별·가입자) |
| 2026-04-18 | 어드민 네비게이션 재구성 (대시보드/상품관리/Leni턴관리/사이트설정 분리) |
| 2026-04-18 | 복습 UX 보완 완료 (세션 선택·목록 페이지, Leni 복습 프롬프트, 복습 완료 DM) |
| 2026-04-20 | Story Learning 기능 구현 완료 (story-deutsch-b1-snowwhite 시즌 1 출시) |
| 2026-04-20 | story stage/card DB 스키마 추가 (nv2_card_type, nv2_stage_type에 story 추가) |
| 2026-04-20 | story-page.tsx: 문장 단위 reveal UX, Auto/Skip/Reset 컨트롤, TTS 자동 재생 |
| 2026-04-20 | session-page.tsx: story 상품용 챕터 요약 카드 (hook_text + 학습 흐름) 추가 |
| 2026-04-20 | chat-page.tsx: story 말풍선 추가 (Leni 채팅에서 챕터 읽기 → 새 탭) |
| 2026-04-20 | product-detail-page.tsx: story/word 상품 유형별 화면 분기 |
| 2026-04-20 | my-learning-page.tsx: 세션 수 nv2_product_sessions count 기반으로 수정 |
| 2026-04-20 | n8n 워크플로우: Snow White B1 S1 생성기 완성 (gpt-4.1, 챕터별 시놉시스 하드코딩) |
| 2026-04-20 | admin.layout.tsx: refresh_token_not_found 처리, 세션 쿠키 갱신 전달 |
| 2026-04-20 | routes.ts: /my-learning, /products/:slug/progress, /story/:stageId, story result API 등록 |
| 2026-04-22 | Leni Cheer DM v2 구현 완료 — n8n postgres 직접연결, OpenAI 개인화 cheer DM, ||| dual-message 포맷, dispatch 세션 재확인 로직 |
| 2026-04-22 | nv2_sessions partial UNIQUE index 추가 (new/review 중복 방지) + 23505 graceful handling 3개 함수 |
| 2026-04-22 | n8n_worker RLS 추가 (nv2_profiles, nv2_product_sessions, nv2_schedules) |
| 2026-04-22 | dispatch.tsx ?schedule_id 파라미터 추가 (강제 발송 테스트용) |
| 2026-04-28 | 마라톤 모드 구현 완료 — entry/stream/mini_quiz/review_quiz/final_quiz/complete 6-phase 상태머신 |
| 2026-04-28 | TTS: _tts_gen 세대 카운터 도입 (React Strict Mode 이중 호출 방지), playTtsSequence() 추가 |
| 2026-04-28 | TTS 재생 순서: title/example → front→back→front→back, description → back×2 |
| 2026-04-28 | 발음듣기 버튼: front→back 1회 시퀀스 |
| 2026-04-28 | 자동 넘김: gen_ref/settings_ref/on_next_ref 패턴으로 stale closure 및 Strict Mode 부작용 해결 |
| 2026-04-28 | 50 스테이지 경계: follow_up_review 필드로 mini_quiz → review_quiz 순서 보장 |
| 2026-04-28 | QuizView key prop 추가 — mini→review 전환 시 내부 상태 초기화 |
| 2026-04-28 | 퀴즈 정답 확인 시 단어 TTS 자동 재생 (mini/review 퀴즈) |
| 2026-04-28 | 스테이지 점프 UI — EntryView에 번호 입력 → jump_stage_ref → handleStart(true) |
| 2026-04-28 | session-choice-page 마라톤 배너 추가 (productSlug 있을 때 표시) |
| 2026-05-01 | marathon_nudge 크론 구현 완료 — 6개 발송 윈도우(06/09/12/15/18/21 ±15분), nudge_card_cursor 기반 카드 미리보기 |
| 2026-05-01 | nv2_marathon_runs에 nudge_card_cursor 컬럼 추가 (migration 0060) |
| 2026-05-01 | nv2_schedule_type enum에 marathon_nudge 추가 |
| 2026-05-01 | sendMarathonNudgeDm (discord.server.ts) — 카드 임베드 + 이어하기 버튼 |
| 2026-05-01 | sendMarathonNudgeEmail (email.server.ts) — HTML 카드 블록 + CTA 버튼 |
| 2026-05-01 | dispatch.tsx에 marathon_nudge 분기 추가 |
| 2026-05-01 | marathon-resume-page.tsx 추가 — /products/:slug/marathon/:runId/resume, runId로 auth 없이 사용자 식별 |
| 2026-05-01 | save-progress·complete API에서 auth.getUser() 제거 — runId UUID가 보안 토큰 역할 (session_id 패턴 적용) |
| 2026-05-01 | getCardAtCursor 버그 수정 — card_data.front/back → card_data.presentation.front/back |
| 2026-05-01 | vitest 설정 및 marathon-nudge 순수 함수 단위 테스트 19개 추가 |