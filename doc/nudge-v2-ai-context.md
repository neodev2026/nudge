# Nudge v2 — AI 컨텍스트 문서

다른 AI에게 서비스 구조와 기능을 설명하기 위한 문서입니다.

---

## 서비스 개요

**Nudge v2**는 언어 학습 서비스입니다. 사용자는 Discord DM 또는 이메일로 학습 세션 링크를 받아 학습을 시작합니다. React Router v7(Remix 모드), Supabase PostgreSQL, Drizzle ORM, Tailwind CSS + Shadcn/ui 스택으로 구성되며 Vercel에 배포됩니다.

주요 학습 상품: 독일어 A1/A2/B1, 스페인어 A1/A2/B1/B2, 히라가나, 카타카나, Snow White × 독일어 B1 (Story Learning)

---

## 전체 URL/라우트 구조

```
/                               랜딩 페이지
/products                       상품 목록
/products/:slug                 상품 상세 페이지
/products/:slug/checkout        구매 페이지
/products/:slug/marathon        마라톤 모드 (전체 단어 연속 학습)
/products/:slug/marathon/result/:runId  마라톤 결과 페이지
/products/:slug/marathon/print  전체 단어 인쇄 시트 (인증 불필요)
/products/:slug/progress        상품별 학습 진도
/sessions/:sessionId            학습 방법 선택 페이지
/sessions/:sessionId/list       세션 학습 목록
/sessions/:sessionId/chat       Leni AI 채팅 학습
/sessions/:sessionId/story      스토리 학습 (story 상품용)
/story/:stageId                 스토리 스테이지 (문장 단위 reveal)
/stages/:stageId                learning 카드 학습
/quiz/:stageId                  퀴즈
/sentence/:stageId              sentence_practice
/dictation/:stageId             받아쓰기
/writing/:stageId               작문
/my-learning                    구독 상품 진행 현황
/account                        계정 설정
/login                          로그인 (이메일 / Google / Discord)
/join                           회원가입
/admin                          어드민 대시보드
/admin/products                 상품 관리
/admin/users                    사용자 관리
/admin/trial-sessions           익명 체험 세션 관리
/admin/leni-turns               Leni 채팅 턴 관리
/admin/site-settings            사이트 설정 (점검 모드)
```

---

## 학습 플로우 요약

```
Discord DM 또는 이메일로 /sessions/:sessionId 링크 수신
→ 학습 방법 선택 페이지 (/sessions/:sessionId)
  ├── [학습 목록] → /sessions/:sessionId/list
  │     → 스테이지별 학습 (learning / quiz / sentence_practice / dictation / writing)
  │     → 모든 스테이지 완료 → 세션 complete → 다음 세션 생성
  ├── [Leni와 학습] → /sessions/:sessionId/chat
  │     → GPT-4 기반 AI 튜터 Leni와 대화형 학습
  └── [마라톤 모드] → /products/:slug/marathon
        → 전체 단어 연속 학습 (아래 별도 설명)
```

---

## 세션 구조

- 홀수 세션: learning×5 + quiz_current_session + sentence_practice (7 스테이지)
- 짝수 세션: learning×5 + quiz_current_session + sentence_practice + quiz_current_and_prev_session (8 스테이지)
- session_kind: `new`(신규) / `review`(복습)
- review_round: 복습 회차 (1~4)

---

## 마라톤 모드 (`/products/:slug/marathon`)

전체 학습 단어를 처음부터 끝까지 연속으로 학습하는 모드. 세션 단위 학습과 완전히 독립적으로 동작. 진행 상태는 `nv2_marathon_runs` 테이블에 저장되어 언제든 이어하기 가능.

### Phase 상태머신 (클라이언트 사이드)

```
entry → stream → [mini_quiz →] [review_quiz →] stream → ... → final_quiz → complete
```

- **entry**: 시작/재개/스테이지 점프 선택 화면
- **stream**: 카드 하나씩 TTS 자동 재생하며 학습
- **mini_quiz**: 5스테이지마다 직전 5개 단어 4지선다 5문항
- **review_quiz**: 50스테이지마다 직전 50개(또는 누적) 단어 퀴즈
- **final_quiz**: 전체 완주 후 전체 단어 퀴즈 (점수 DB 저장)
- **complete**: 결과 저장 후 result 페이지로 이동

**50 스테이지 경계**: 미니 퀴즈 완료 후 복습 퀴즈가 연결됨 (mini_quiz의 follow_up_review 필드).

### EntryView 액션

| 버튼 | 동작 |
|---|---|
| N번째 단어부터 이어하기 | 저장된 last_stage_index부터 재개 |
| 처음부터 시작 / 마라톤 시작 | 새 런 생성 |
| 전체 퀴즈 바로 시작 | 학습 없이 final_quiz 즉시 진입 |
| 스테이지 이동 (번호 입력) | 입력한 번호의 스테이지부터 새 런 시작 |
| 전체 출력 | /products/:slug/marathon/print (새 탭) |

### StreamView 화면 구성

```
[상단] ⏸ 일시정지 | N / total_stages | ⚙️ 설정
[진행바] 현재 진행률 (초록)
[카드]
  title:       단어(front, 크게) + 의미(back, 초록) + 🔊 발음듣기
  description: 설명(back, 한국어) + 🔊 다시듣기
  example:     예문(front) + 번역(back) + 🔊 발음듣기
  etymology:   어원(front) + 설명(back)
  image:       이미지 + 설명
[다음 →]  자동 넘김 카운트다운 표시
[카드 N / M]
[다음 50 스테이지 퀴즈로 점프]  조건부 표시
```

### TTS 재생 방식

| 상황 | 재생 내용 | 순서 |
|---|---|---|
| title/example 카드 진입 자동재생 | front(타겟 언어) + back(한국어) | front → back → front → back |
| description 카드 진입 자동재생 | back(한국어 설명) | back → back |
| 발음듣기 버튼 | front + back | front → back (1회씩) |
| 다시듣기 버튼 (description) | back | back → back |
| 퀴즈 정답 확인 | 해당 단어 | word → word (2회) |

재생 속도: 타겟 언어 0.9x, 한국어 0.9 × 1.2 = 1.08x

### 설정 패널 (localStorage 저장)

- 자동 넘김 ON/OFF + 대기 시간 (1/2/3/5초)
- 퀴즈 시간제한 ON/OFF + 제한 시간 (5/8/10/15초)
- 미니 퀴즈 건너뛰기
- 복습 퀴즈 건너뛰기
- 복습 퀴즈 이전 내용 포함 (누적)

### QuizView (미니/복습/최종 퀴즈 공용)

- 4지선다, word_to_meaning 또는 meaning_to_word 랜덤 출제
- 정답 확인 후: 피드백 표시 + 단어 TTS 자동 재생 (mini/review만)
- 3초 자동 넘김 토글
- 마지막 문제로 점프 (건너뛴 문제 전부 오답 처리)
- 퀴즈 레이블: "미니 퀴즈 · 50개 완료", "복습 퀴즈 · 51~100번", "복습 퀴즈 · 누적 100개"

### API

| 메서드 + 경로 | 설명 | 요청 Body |
|---|---|---|
| POST /api/v2/marathon/:slug/start | 런 생성/재개/초기화 | { restart: boolean } |
| POST /api/v2/marathon/:runId/save-progress | 진행 상태 저장 | { last_stage_index: number } |
| POST /api/v2/marathon/:runId/complete | 최종 결과 저장 | { score, total_questions, elapsed_seconds, answers[] } |

### DB 테이블

**nv2_marathon_runs**
- id, auth_user_id, product_id, run_number
- status: `in_progress` | `completed`
- last_stage_index, score, total_questions, elapsed_seconds
- started_at, completed_at

**nv2_marathon_answers**
- id, run_id (FK), stage_id, question_direction, is_correct, answered_at
- unique constraint: (run_id, stage_id)

---

## 주요 DB 테이블 목록

| 테이블 | 용도 |
|---|---|
| nv2_learning_products | 학습 상품 (name, slug, category, meta{language,level}, price, total_stages) |
| nv2_product_sessions | 상품 세션 정의 |
| nv2_stages | 스테이지 (stage_type: learning/quiz/sentence_practice/dictation/writing/story) |
| nv2_cards | 카드 (card_type, card_data JSONB) |
| nv2_sessions | 사용자 세션 (session_kind: new/review, status) |
| nv2_stage_progress | 스테이지 진도 (completed_at, last_review_completed_at) |
| nv2_subscriptions | 구독 (auth_user_id, product_id, is_active, source: paid/free/admin) |
| nv2_profiles | 사용자 프로필 (discord_id, email, timezone) |
| nv2_schedules | DM 발송 큐 |
| nv2_marathon_runs | 마라톤 런 기록 |
| nv2_marathon_answers | 마라톤 최종 퀴즈 답변 |
| nv2_chat_turns | Leni AI 채팅 이력 |
| nv2_turn_balance | AI 채팅 턴 잔여량 |

---

## 카드 타입 (card_type)과 card_data 구조

모든 카드는 `card_data` JSONB 컬럼에 아래 구조를 가집니다:

```json
{
  "meta": { "target_locale": "de" },
  "presentation": {
    "front": "단어 또는 문장 (타겟 언어)",
    "back":  "의미 또는 번역 (한국어)"
  },
  "details": {
    "explanation": "추가 설명 (선택)"
  }
}
```

| card_type | front | back |
|---|---|---|
| title | 단어 (de/en/ja 등) | 의미 (한국어) |
| example | 예문 (타겟 언어) | 번역 (한국어) |
| description | (사용 안 함) | 설명 (한국어) |
| etymology | 어원 정보 | 추가 설명 |
| image | 이미지 URL | 설명 |

---

## 인증 시스템

- Supabase Auth (이메일+비밀번호 / Google OAuth / Discord OAuth)
- `auth_user_id`: Supabase `auth.users.id` (UUID) — 모든 nv2_ 테이블의 사용자 식별 키
- 익명 세션: `auth_user_id = 'anon:<uuid>'` (로그인 없이 무료 체험)

---

## Leni AI 채팅

- 캐릭터: 15세 독일 소녀, 존댓말, 밝고 긍정적
- 모델: GPT-4
- 신규 세션 흐름: 카드 전시 → 사용자 요약 → 퀴즈 → 실전 대화
- 복습 세션 흐름: 단어만 나열(인출 테스트) → 기억 평가 → 카드 보강 → 퀴즈 → 약점 집중 대화
- 턴 소비: 사용자 메시지 1회당 1턴 (월정기권/충전권)

---

## Cron 자동화

| Job | 역할 |
|---|---|
| enqueue-daily (30분) | 학습 알림 DM 큐 생성 |
| dispatch (5분) | pending 스케줄 발송 (Discord DM / 이메일) |
| daily-reset (30분) | 일별 카운터 초기화 |
| n8n leni-cheer-dm-v2 (2시간) | 미완료 세션 cheer DM 큐 생성 (OpenAI 개인화) |

DM 채널 결정: discord_id 있으면 Discord Bot DM, 없으면 Resend 이메일.

---

## 코딩 규칙 요약

- loader 패턴: `useLoaderData<typeof loader>()` (Route.ComponentProps 금지)
- RLS 우회: adminClient (service role key) 사용
- DB 스키마 변경: schema.ts → db:generate → db:migrate 순서
- Supabase error throw: `throw new Error(err.message)` (if(err) throw err 금지)
- .in() 쿼리: 대량 ID는 nested select로 대체 (URL 길이 초과 방지)
- 코드 코멘트/커밋 메시지: 영어
- 미사용 코드: 삭제 말고 주석 처리
