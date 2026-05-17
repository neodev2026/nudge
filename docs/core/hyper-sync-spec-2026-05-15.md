# Hyper-Sync 구현 스펙 v2.1

**작성일**: 2026-05-15
**이전 버전**: v2.0 (2026-05-14, 첨부 문서로 공유됨)
**구현 대상**: Claude Code
**기반 프로젝트**: Nudge v2 (React Router v7 / Supabase / Drizzle ORM)
**레포**: 기존 Nudge v2 레포 동일 사용
**도메인**: nudge.neowithai.com (URI 기준 구분)

---

## 0. 사전 지식 (읽기 필수)

- 프로젝트 설계 문서: `docs/core/nudge-v2-design-2026-04-20.md`
- AI 컨텍스트: `docs/core/nudge-v2-ai-context.md`
- 기존 마라톤 참고: `app/features/v2/marathon/screens/marathon-page.tsx`
- 기존 TTS 패턴: `_tts_gen` 카운터, `playTtsSequence()`, `stopTts()` ([marathon-page.tsx:102-148](../../app/features/v2/marathon/screens/marathon-page.tsx#L102-L148))
- 기존 schedule 인프라: `app/features/v2/schedule/schema.ts`, `app/features/v2/cron/api/dispatch.tsx`
- 기존 timezone-aware 발송: `app/features/v2/cron/api/enqueue-daily.tsx` (`buildScheduledAt` 헬퍼)

---

## 0.1 v2.0 → v2.1 변경 요약 (결정 로그)

v2.0에서 결정·교정된 항목입니다.

| ID | 항목 | v2.0 | v2.1 (확정) | 이유 |
|---|---|---|---|---|
| B-1 | 루트 도메인 교체 | `/` 80/20 split + `/nudge` 분리 | **Phase 1에서 미실행.** `/hyper-sync` URI만 추가 | 기존 home(752줄), trial marathon CTA, G-01 회귀 항목 영향 큼 → 별도 Phase에서 결정 |
| B-3 | 카드 표시 범위 | `card.front/back` 단순 가정 | **`presentation.front/back`만 사용.** `hint`, `details.explanation` 무시 | UX 단순화, 콘텐츠 작성 부담 ↓ |
| B-6 | 상품 slug | 미정 | **`developer-english`** | 시드 데이터 작성 기준 |
| B-7 | 복습 발송 인프라 | 신규 `nv2_hyper_sync_review_schedules` 테이블 | **기존 `nv2_schedules` 재사용** + enum에 `hyper_sync_review` 추가 | dispatch cron, 채널 라우팅, retry, 구독 해제 처리 등 인프라 전체 재사용 |
| B-8 | 다음 미션 정의 | 미정 | **`display_order` 기준 다음 `session_id`** | 가장 단순. 익명 사용자에게도 동일 동작 |
| B-9 | 자동 unknown 타이머 | 3초 | **3초 (확정)** | 빠른 리듬 유지 우선 |
| TZ | scheduled_at | "다음날 새벽 8시 UTC" | **사용자 `nv2_profiles.timezone` 기준 항상 다음 캘린더일 09:00**. 신규 `nextMorningAt(tz, 9)` 헬퍼 (§3.4) | 기존 `buildScheduledAt`은 "오늘 09:00"이라 오후 완료자에게 즉시 발송됨. NUDGE_SCHEDULE_TIMES morning slot과 정렬 |
| SRS | box_level | §3.4 컬럼으로 정의 | **Phase 1 보류.** 단발 복습 1회만. 향후 `nv2_schedules.review_round` 컬럼 재활용 | 데이터 누적 후 효과 검증 필요 |
| TTS-1 | 언어 감지 | 정규식 휴리스틱 | **`TTS_LANG_MAP[card_data.meta.target_locale]`** | 기존 marathon-page 패턴과 통일 |
| IMP-1 | Supabase server client | `createSupabaseServerClient` | **`makeServerClient(request)`** ([core/lib/supa-client.server](../../app/core/lib/supa-client.server.ts)) | v1.0/v2.0 모두 import 경로 오기 — 실제 헬퍼명으로 교정 |
| FB-1 | 발송 채널 | Discord 전용, 미연동 시 skip | **Discord → 이메일 폴백 → skip**. `sendHyperSyncReviewEmail` 추가 | TC-HS-12에서 Discord 미연동 테스트 계정이 `skipped=1`로만 떨어지는 문제 — 실서비스 도달율 ↑ |
| FB-2 | 헤더 UX | Nudge 로고만 | 비로그인 시 **로그인/회원가입 버튼** 추가 ([HyperSyncHeader](../../app/features/v2/hyper-sync/components/hyper-sync-header.tsx)) | 익명 사용자가 결과 화면 CTA 외에도 헤더에서 회원가입 진입 가능 |
| FB-3 | `shouldRevalidate` 범위 | 무조건 false (sessionId 변경에도 loader 차단) | **URL 변경 시 default, 동일 URL에서만 false**. sessionId 변경 시 state 리셋 effect 추가 | 결과 화면 [다음 미션] 클릭 시 페이지가 갱신되지 않던 버그 ([session-page](../../app/features/v2/hyper-sync/screens/hyper-sync-session-page.tsx)) |
| FB-4 | 중복 enqueue 정책 | (미정) | **per-session schedule + card 단위 dedup**. 통합 알림은 보류 (§3.4) | 알림이 N건 분리되어 도착하는 부담은 인지. 베타 단계 수용 가능, 필요 시 향후 append 기반 단일 알림으로 전환 |
| FB-5 | SRS box_level | Phase 1 보류 → **Phase 2 정식 구현** | 슬로건 "복습으로 기억 유지"의 필수 메커니즘. nv2_stage_progress 재사용 (신규 테이블 없음). §6.6 참조 | 단발 복습으로는 슬로건 약속 불충분. 사용자 멘탈모델 ("기억함 stage도 망각곡선 기반 복습")과 정렬 |
| FB-6 | DM 묶음 전략 | per-card schedule = N개 DM | **Dispatch-time aggregation**: 같은 사용자의 due schedule들을 1개 DM에 합산 + 멀티 schedule URL (`/hyper-sync/review?ids=1,2,3`). Review 페이지에서 **10개씩 청크 페이지네이션** | "10개 미션 = 10개 DM" 문제 해결. 신규 테이블/cron 불필요 (Phase 2 Option B). 베타 단계에서 비용 최소 |

---

## 1. 제품 정의

### 1.1 한 줄 정의

개발자가 실무에서 자주 만나는 기술 영어 표현을 3분 안에 점검하고, 틀린 표현을 Discord DM으로 복습받는 경량 학습 루프.

### 1.2 핵심 포지셔너

Hyper-Sync는 종합 영어 학습 서비스가 아니다. 다음 문제를 해결한다.

> GitHub PR, 기술 면접, 오픈소스 문서에서 자주 마주치는 표현을 놓치지 않도록 매일 짧게 다시 쓸어주는 시스템.

### 1.3 기존 Nudge와의 관계

| | Hyper-Sync | 기존 Nudge |
|---|---|---|
| 타겟 | IT 개발자 / 기술 영어 | 언어 학습자 (독일어/스페인어 등) |
| 콘텐츠 | 기술 영어 표현 (수십 개 이상) | 언어 커리큘럼 (A1~B1) |
| 진입 | 익명 허용, 즉시 시작 | 로그인 필요 |
| URI | `/hyper-sync` | `/`, `/products`, `/sessions/:id` 등 |

### 1.4 수익 모델

- **무료**: 미션 플레이 (콘텐츠 전체)
- **유료**: Discord DM 배달 + 복습 관리 (단, Phase 1에서는 모든 로그인 사용자 무료)

---

## 2. MVP 핵심 가설

1. 개발자는 "영어 공부"보다 "기술 영어 표현 점검"에 더 반응한다.
2. 회원가입 없는 3분 미션이 첫 사용 장벽을 낮춘다.
3. 틀린 표현을 Discord DM으로 받으면 재방문율이 올라간다.
4. 작은 성공(3분 완주)의 반복이 습관을 만든다.

---

## 3. 데이터 구조

### 3.1 콘텐츠 계층 — 기존 nv2_* 재사용

```
nv2_learning_products (slug = "developer-english")
  └─ nv2_product_sessions          ← 사용자에게는 "미션"으로 표시
       └─ nv2_stages (stage_type = "learning")
            └─ nv2_cards (card_type = "title" + "example")
```

- session 1개 = 미션 1개
- stage 1개 = 단어/표현 1개
- 미션당 10개 stage (= 카드 10장)
- card_type
  - `title`: front = 표현, back = 한국어 의미
  - `example`: front = 예문, back = 번역
  - (모든 stage는 title 1장 + example 1장의 쌍으로 구성)

### 3.2 카드 데이터 매핑 — V2CardData JSONB

실제 [V2CardData](../../app/features/v2/shared/types.ts) 구조 중 **`presentation.front`, `presentation.back`만 사용**한다.

```json
// title 카드 예시
{
  "meta":         { "target_locale": "en", "learner_locale": "ko", "logic_key": "..." },
  "presentation": { "front": "reduce latency", "back": "지연 시간을 줄이다" },
  "details":      { "explanation": "..." }
}
```

- `presentation.hint`, `details.explanation`, `details.example_context` — **읽지 않음**
- `meta.target_locale` — **TTS 언어 결정에만 사용** (§6.4)

### 3.3 신규 테이블: `nv2_hyper_sync_results`

기존 `nv2_cards`는 읽기 전용. 결과만 신규 테이블에 저장.

```typescript
// app/features/v2/hyper-sync/schema.ts
import { sql } from "drizzle-orm";
import {
  pgEnum, pgPolicy, pgTable, uuid, text, integer,
  timestamp, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";
import { tstz } from "~/core/db/helpers.server";
import { isAdmin } from "~/core/db/helpers.rls";

export const hyperSyncResultEnum = pgEnum("hyper_sync_result", ["known", "unknown"]);

export const nv2_hyper_sync_results = pgTable(
  "nv2_hyper_sync_results",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    auth_user_id: text("auth_user_id").notNull(),    // 익명: 'anon:<uuid>', 로그인: auth.users.id
    product_id:   uuid("product_id").notNull(),       // nv2_learning_products.id
    session_id:   uuid("session_id").notNull(),       // nv2_product_sessions.id (= 미션 ID)
    card_id:      uuid("card_id").notNull(),          // nv2_cards.id (title 카드 기준)
    result:       hyperSyncResultEnum("result").notNull(),
    known_count:  integer("known_count").notNull().default(0),
    session_date: text("session_date").notNull(),     // 'YYYY-MM-DD' KST 기준
    ...tstz,
  },
  (t) => [
    // 같은 사용자가 같은 카드를 같은 날 다시 풀면 upsert (덮어쓰기)
    uniqueIndex("nv2_hyper_sync_results_user_card_date_uidx")
      .on(t.auth_user_id, t.card_id, t.session_date),

    index("nv2_hyper_sync_results_user_idx").on(t.auth_user_id),
    index("nv2_hyper_sync_results_session_idx").on(t.session_id),

    // RLS 정책
    pgPolicy("nv2_hyper_sync_results_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.auth_user_id} = auth.uid()::text`,
    }),
    pgPolicy("nv2_hyper_sync_results_service_all", {
      for: "all",
      to: "service_role",
      using: sql`true`,
    }),
    pgPolicy("nv2_hyper_sync_results_admin_all", {
      for: "all",
      to: authenticatedRole,
      using: isAdmin,
    }),
  ]
);
```

> 익명 사용자의 INSERT는 RLS 우회가 필요하므로 action 엔드포인트에서 **`adminClient`(service_role)** 로 직접 INSERT한다. 클라이언트에서 직접 INSERT하지 않는다.

### 3.4 기존 `nv2_schedules` 재사용 (Discord 복습 발송)

신규 schedule 테이블을 만들지 않는다. 기존 [nv2_schedules](../../app/features/v2/schedule/schema.ts) 에 다음 한 줄만 추가한다.

```typescript
// app/features/v2/schedule/schema.ts — nv2ScheduleType enum 확장
export const nv2ScheduleType = pgEnum("nv2_schedule_type", [
  "new",
  "review",
  "cheer",
  "welcome",
  "marathon_nudge",
  "hyper_sync_review",  // ← 추가
]);
```

#### `message_body` 페이로드 컨벤션

`stage_id` 컬럼은 단일 stage 가정이라 부적합. `message_body`에 파이프 인코딩.

```
hyper_sync|{product_slug}|{source_session_id}|{card_id1,card_id2,...}|{total_unknown}
```

- `stage_id`는 `null` (FK는 nullable + `onDelete: 'set null'`이므로 안전)
- `review_round`는 `null` (Phase 1 SRS 미사용)
- `delivery_url` = `https://nudge.neowithai.com/hyper-sync/review/{scheduleId}` (§5.4)

#### `scheduled_at` 계산 — 항상 다음 캘린더일 09:00

기존 `buildScheduledAt(tz, 9)`는 "오늘 09:00"을 반환하므로 그대로 쓰면 오후/저녁 완료자에게 과거 시각이 되어 즉시 발송된다. Hyper-Sync는 **항상 사용자 로컬 다음 캘린더일 09:00**으로 계산한다.

```typescript
// hyper-sync 전용 헬퍼 — buildScheduledAt 패턴을 1일 시프트
function nextMorningAt(timezone: string, hour: number): string {
  // 1. 사용자 로컬 오늘 날짜 (YYYY-MM-DD)
  const today_str = new Date().toLocaleDateString("en-CA", { timeZone: timezone });
  // 2. +1일
  const tomorrow = new Date(today_str + "T00:00:00Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrow_str = tomorrow.toISOString().slice(0, 10);
  // 3. 사용자 로컬 hour로 조립 후 UTC ISO로 변환
  const local_str = `${tomorrow_str}T${String(hour).padStart(2, "0")}:00:00`;
  const utc_offset_ms =
    new Date(local_str).getTime() -
    new Date(new Date(local_str).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(new Date(local_str).getTime() - utc_offset_ms).toISOString();
}

// 사용
const profile = await client.from("nv2_profiles")
  .select("timezone").eq("auth_user_id", userId).single();

const scheduled_at = nextMorningAt(profile?.timezone ?? "Asia/Seoul", 9);
```

#### 갭(완료 시각 ↔ 발송 시각) 분포

| 완료 시각 (KST) | 발송 시각 (KST) | 갭 |
|---|---|---|
| 월 14:00 | 화 09:00 | 19h |
| 월 21:00 | 화 09:00 | 12h |
| 월 23:30 | 화 09:00 | 9.5h |
| 화 02:00 | 수 09:00 | 31h |

> 최소 9시간(23:59 완료) ~ 최대 33시간(00:01 완료). 모든 사용자가 "다음 아침에 받는다"는 일관된 멘탈모델.

#### 익명 사용자

- `auth_user_id.startsWith('anon:')` → schedule INSERT **스킵**
- 결과 화면에서 "로그인하면 Discord/이메일로 받을 수 있어요" CTA만 노출

#### 전달 채널 우선순위 (v2.1 갱신 — 이메일 폴백 추가)

dispatch가 schedule을 픽업할 때 다음 순서로 채널을 선택한다.

1. **Discord DM** — `discord_id` 있고 `discord_dm_unsubscribed = false`
2. **이메일** — Discord 미연동/구독해제, 그리고 `email` 있고 `email_unsubscribed = false`
3. **Skip** — 양쪽 모두 사용 불가. `status='sent'`로 종결 (재시도 큐 차단)

이메일 폴백 추가는 운영 중 "Discord OAuth 안 한 사용자에게 전혀 도달하지 못함" 문제를 해결한다. 이메일 발송기는 [sendHyperSyncReviewEmail](../../app/features/v2/auth/lib/email.server.ts) 사용.

#### 중복 방지 (per-session schedule + card 단위 dedup)

같은 사용자의 같은 카드가 여러 번 pending에 쌓이지 않도록 enqueue 시 dedup. **중복 카드만 제거하고, 새로운 카드가 1개라도 있으면 별도 schedule row를 INSERT**한다 (기존 pending에 append하지 않음).

결과: 사용자가 하루에 여러 미션을 완료해서 unknown 카드가 각각 발생하면, 다음 아침에 schedule 개수만큼의 알림(DM 또는 이메일)이 분리되어 도착한다. v2.1 결정 사항으로 — append 기반 통합 알림은 구현 단순성/동시성 안전 이유로 보류. 필요 시 v2 이후 도입.

```typescript
// 의사 코드
const existing = await client
  .from("nv2_schedules")
  .select("schedule_id, message_body")
  .eq("auth_user_id", userId)
  .eq("schedule_type", "hyper_sync_review")
  .eq("status", "pending");

const alreadyPendingCardIds = new Set(
  existing.flatMap(row => parseHyperSyncMessageBody(row.message_body).cardIds)
);
const newCardIds = unknownCardIds.filter(id => !alreadyPendingCardIds.has(id));

if (newCardIds.length > 0) {
  await client.from("nv2_schedules").insert({ ... });
  // → 신규 schedule row 1건 추가. 기존 pending row와 별도로 존재.
}
```

예시: 기존 pending `[A,B,C]` 1건 + 신규 unknown `[B,C,D]` enqueue → 신규 schedule `[D]` 1건 INSERT. 최종 pending 2건.

### 3.5 dispatch.tsx 분기 추가

[dispatch.tsx:116-257](../../app/features/v2/cron/api/dispatch.tsx#L116-L257) 의 `if/else if/else` 체인에 분기 추가. v2.1에서 이메일 폴백을 포함하도록 갱신됨.

```typescript
} else if (schedule.schedule_type === "hyper_sync_review") {
  // message_body: "hyper_sync|{slug}|{session_id}|{card_ids}|{total}"
  const parsed = parseHyperSyncMessageBody(schedule.message_body);
  const total_unknown = parsed?.totalUnknown ?? 0;

  if (use_discord) {
    await sendHyperSyncReviewDm(discord_id!, schedule.delivery_url, total_unknown);
  } else if (use_email) {
    await sendHyperSyncReviewEmail(email!, schedule.delivery_url, total_unknown);
  } else {
    await markCronScheduleSent(client, schedule_id);
    results.skipped++;
    continue;
  }
}
```

발송기:
- `sendHyperSyncReviewDm` — `discord.server.ts` ([sendSessionDm:165](../../app/features/v2/auth/lib/discord.server.ts#L165) 패턴 답습)
- `sendHyperSyncReviewEmail` — `email.server.ts` ([sendSessionEmail:212](../../app/features/v2/auth/lib/email.server.ts#L212) 패턴 답습)

### 3.6 스키마 변경 절차 (필수)

```bash
# schema.ts 수정 후 반드시 아래 순서로 실행
npm run db:generate
npm run db:migrate

# Supabase SQL Editor 직접 실행 금지 (단, enum 값 추가 마이그레이션은
# drizzle-kit이 ALTER TYPE으로 자동 생성하므로 그대로 진행)
```

### 3.7 Drizzle enum 규칙

- schema.ts 내부에서 직접 인라인 정의 (constants.ts import 금지 — drizzle-kit ZodError)
- enum 값 추가 시 기존 값 순서 변경 금지

---

## 4. 라우트 및 파일 구조

### 4.1 URI 구조 (Phase 1)

```
/hyper-sync                       → 미션 선택 페이지
/hyper-sync/session               → 미션 진행 (query: productId, sessionId)
/hyper-sync/review/:scheduleId    → Discord DM에서 진입하는 복습 페이지
```

루트(`/`), `/nudge` 등 기존 URI는 변경 없음.

### 4.2 신규 파일

```
app/features/v2/hyper-sync/
├── schema.ts                      → nv2_hyper_sync_results
├── screens/
│   ├── hyper-sync-landing-page.tsx     → /hyper-sync
│   ├── hyper-sync-session-page.tsx     → /hyper-sync/session
│   └── hyper-sync-review-page.tsx      → /hyper-sync/review/:scheduleId
├── lib/
│   ├── queries.server.ts          → DB 쿼리
│   ├── session-logic.ts           → 순수 함수 (테스트 가능)
│   └── message-body.ts            → message_body 파싱/직렬화
├── api/
│   ├── save-result.tsx            → POST /api/v2/hyper-sync/save-result
│   └── enqueue-review.tsx         → POST /api/v2/hyper-sync/enqueue-review
└── __tests__/
    ├── session-logic.test.ts
    ├── message-body.test.ts
    └── queries.test.ts
```

추가로 수정되는 기존 파일:
- `app/features/v2/schedule/schema.ts` — enum 값 추가
- `app/features/v2/cron/api/dispatch.tsx` — `hyper_sync_review` 분기
- `app/features/v2/auth/lib/discord.server.ts` — `sendHyperSyncReviewDm` 추가
- `app/routes.ts` — 위 3개 screen + 2개 API 라우트 등록

### 4.3 routes.ts 등록 + 레이아웃 정책

**레이아웃 결정**: v2-nav layout **미적용**. 헤더 메뉴(`학습 방법 / 학습 상품 / 마라톤 랭킹`)는 Hyper-Sync 페이지에 노출하지 않는다. 각 페이지 상단에 **Nudge 로고만** 표시하는 minimal header를 직접 그린다.

- 구현 방법: 공통 컴포넌트 `app/features/v2/hyper-sync/components/hyper-sync-header.tsx`를 만들어 3개 페이지에서 import
- 표시 항목: `NUDGE` 로고만 (필요 시 우측에 `/ hyper-sync` 서브타이틀)
- 클릭 시 동작: 로고 클릭 → `/` (기존 home으로 이동)

```typescript
// app/routes.ts — v2 learning routes 아래 (no nav bar):
route("/hyper-sync",                     "features/v2/hyper-sync/screens/hyper-sync-landing-page.tsx"),
route("/hyper-sync/session",             "features/v2/hyper-sync/screens/hyper-sync-session-page.tsx"),
route("/hyper-sync/review/:scheduleId",  "features/v2/hyper-sync/screens/hyper-sync-review-page.tsx"),

// /api/v2 아래:
route("/hyper-sync/save-result",   "features/v2/hyper-sync/api/save-result.tsx"),
route("/hyper-sync/enqueue-review","features/v2/hyper-sync/api/enqueue-review.tsx"),
```

> **주의**: routes.ts 등록 전 파일 먼저 생성. 미생성 시 React Router 7 ENOENT 크래시.

---

## 5. 화면 구성

### 5.1 미션 선택 페이지 (`/hyper-sync`)

**Loader**:
- 익명/로그인 모두 접근 가능 — 차단 없음
- `nv2_learning_products.slug = 'developer-english'` 조회
- `nv2_product_sessions` (is_active=true, display_order ASC) 목록 조회
- 각 session의 stage 수 포함
- 반환: `{ missions: [{ id, name, stageCount }] }`

**UI 구성**:
```
[헤더] NUDGE / hyper-sync

[타이틀] 미션을 선택하세요
[서브]   각 미션은 3분 안에 완료됩니다

[미션 카드 목록]
  ┌────────────────────────────────────────┐
  │ 개발자 실무 영어 3분컷 — 1               │
  │ [10개] [~3분]                          [시작하기 →]│
  └────────────────────────────────────────┘
  ...

[하단 힌트]
  로그인하면 틀린 표현을 다음날 Discord DM으로 받을 수 있어요.
```

### 5.2 미션 진행 페이지 (`/hyper-sync/session`)

**Loader**:
- query: `productId`, `sessionId`
- 둘 중 하나라도 없으면 `/hyper-sync`로 redirect
- 해당 session의 stage들에서 `card_type='title'` + `card_type='example'` 카드 조회
- 부모-자식 nested select 사용 (`.in()` URL 초과 위험 회피)
- Fisher-Yates shuffle **서버에서 수행** (hydration mismatch 회피)
- 반환: `{ cards: CardEntry[], sessionId, productId, productSlug }`

**CardEntry 타입**:
```typescript
type TitleCard = { id: string; front: string; back: string };
type ExampleCard = { id: string; front: string; back: string };
type CardEntry = { titleCard: TitleCard; exampleCard: ExampleCard | null };
```

(B-3 결정: `card_data.presentation.front/back`만 매핑)

**화면 구성**:
```
[상단]   진행바 + 진행 텍스트 ("N / 10" 또는 "복습 N/5 · 단어")
[중앙]   카드 (앞면 → 뒷면)
[하단]   [기억못함] [기억함] 버튼
[결과]   세션 완료 시 인라인 전환
```

### 5.3 결과 화면 (인라인)

미션 진행 페이지 내부에서 phase 전환으로 표시 (별도 라우트 없음).

```
[타이틀] 3분 컷 완료! 🎉
[서브]   소요 시간 MM:SS

[통계 3개]
  전체 10개 | 기억함 N개 | 기억못함 N개

[기억못함 목록]
  표현 | 의미 | "기억못함" 배지

[CTA — 로그인 상태에 따라 분기]
  익명:   "틀린 표현을 내일 Discord로 받아보세요 → [로그인]"
  로그인 + Discord 연동:
          "내일 아침 Discord로 N개 복습 예약됨 ✓"
  로그인 + Discord 미연동:
          "Discord 연동하면 복습 DM을 받을 수 있어요 → [Discord 연결]"

[버튼]
  [다음 미션]  → 단순 다음 session_id (display_order 기준, B-8)
  [처음으로]   → /hyper-sync
```

### 5.4 복습 페이지 (`/hyper-sync/review/:scheduleId`)

**Loader**:
- `scheduleId` 파라미터로 `nv2_schedules` 조회
- 로그인 사용자 본인 또는 service_role만 접근 (RLS)
- `message_body`에서 `card_ids` 파싱
- 해당 카드들의 데이터를 로드 (title 기준, example 동반)
- 진입 시 schedule의 `opened_at` 업데이트

**진행 로직**:
- §6의 5-step 복습 로직과 동일하나, 모든 카드가 처음부터 step 1로 시작
- 일반 진행과 retry 진행의 구분 없음 — 전부 복습 모드
- 완료 시 결과 화면 (인라인)
- "내일 다시" 또는 "처음으로" 버튼

> 같은 카드를 다시 틀려도 Phase 1에서는 추가 복습 schedule을 enqueue하지 않음 (SRS 미적용 — §6.6).

---

## 6. 세션 로직 상세

### 6.1 카드 진행 타이밍

```
[앞면 노출]
  - presentation.front 표시
  - TTS 자동 1회 재생 (§6.4)
  - 2초 대기 (FRONT_PAUSE)

[뒷면 노출]
  - presentation.back 추가 표시
  - [기억못함] [기억함] 버튼 등장
  - 3초 타이머 시작 (TIMER_SEC, B-9)
  - 무응답 시 자동 '기억못함' 처리

[판정 후]
  - 기억함: 초록 플래시 0.4초 → 다음 카드
  - 기억못함: 붉은 흔들림 0.4초 → retryQueue 추가 → 다음 카드
```

### 6.2 5-Step 복습 로직 (핵심)

"기억못함" 판정 시 `retryQueue`에 추가하여 일반 카드보다 **우선** 처리한다.

| step | 카드 | 방향 | TTS 언어 |
|---|---|---|---|
| 1 | title | 표현 → 의미 (정방향) | `target_locale` |
| 2 | title | 의미 → 표현 (역방향) | `ko-KR` |
| 3 | example | 예문 → 번역 | `target_locale` |
| 4 | title | 의미 → 표현 (역방향) | `ko-KR` |
| 5 | title | 표현 → 의미 (정방향) | `target_locale` |

**규칙**:
- example 카드가 `null`이면 step 3을 title 정방향으로 대체
- 어느 step에서든 "기억함" → 즉시 통과 (남은 step 스킵)
- "기억못함" → `step++`, `step > 5`면 retryQueue에서 제거
- 복습 결과는 최종 집계(기억함/기억못함 수)에 **포함하지 않음**
- 진행 텍스트: `복습 N/5 · 단어` / `복습 N/5 · 역방향` / `복습 N/5 · 예문`

```typescript
// session-logic.ts — 순수 함수, vitest 단위 테스트 대상
export function getRetryCard(
  stage: CardEntry,
  step: 1 | 2 | 3 | 4 | 5
): { card: { front: string; back: string }; isFlipped: boolean; isExample: boolean } {
  if (step === 1 || step === 5) {
    return { card: stage.titleCard, isFlipped: false, isExample: false };
  }
  if (step === 2 || step === 4) {
    return {
      card: { front: stage.titleCard.back, back: stage.titleCard.front },
      isFlipped: true,
      isExample: false,
    };
  }
  // step 3
  if (stage.exampleCard) {
    return { card: stage.exampleCard, isFlipped: false, isExample: true };
  }
  return { card: stage.titleCard, isFlipped: false, isExample: false };
}
```

### 6.3 TTS 구현

기존 [marathon-page.tsx:102-148](../../app/features/v2/marathon/screens/marathon-page.tsx#L102-L148) 패턴 그대로 재사용.

```typescript
// 모듈 레벨 generation 카운터 — React Strict Mode 대응
let _tts_gen = 0;

function stopTts() { _tts_gen++; window.speechSynthesis?.cancel(); }

function playTtsOnce(text: string, lang: string) {
  stopTts();
  const my_gen = _tts_gen;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang;
  utt.rate = 0.9;
  utt.onend = () => { /* no-op */ };
  window.speechSynthesis.speak(utt);
}

// 언어 결정 — 휴리스틱 금지, meta.target_locale 사용 (v2.0 교정)
const TTS_LANG_MAP: Record<string, string> = {
  en: "en-US", de: "de-DE", ja: "ja-JP", ko: "ko-KR",
  fr: "fr-FR", es: "es-ES",
};

function pickTtsLang(card_data: V2CardData, isFlipped: boolean): string {
  if (isFlipped) return "ko-KR";  // 역방향: 앞면이 한국어
  return TTS_LANG_MAP[card_data.meta.target_locale] ?? "en-US";
}
```

> 모바일 iOS Safari user gesture 정책: 첫 카드 TTS가 차단될 수 있음. 미션 시작 버튼 클릭 직후 무음 utterance로 unlock 적용.

### 6.4 익명 세션 처리

```typescript
// client-side
const ANON_KEY = "nudge_anon_id";

function getOrCreateAnonId(): string {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = `anon:${crypto.randomUUID()}`;
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}
```

- 결과 저장 시 `auth_user_id` 필드에 그대로 입력
- daily-reset cron이 7일 후 자동 정리 (CLAUDE.md "익명 세션" 규칙)
- 익명 사용자는 복습 schedule INSERT **스킵** (§3.4)

### 6.5 카드 판정 후 흐름

```typescript
function nextCard() {
  if (retryQueue.length > 0) {
    showRetryCard(retryQueue[0]);  // 복습 우선
    return;
  }
  if (idx >= cards.length) {
    endSession();  // 모든 일반 카드 + 복습 완료
    return;
  }
  showCard(cards[idx]);
}
```

복습이 남아 있으면 일반 카드 진행 대신 복습 카드로 이동. 일반 카드 인덱스는 일반 카드 완료 시점에만 증가.

### 6.6 SRS (Spaced Repetition) — Phase 2 정식 설계

슬로건 "고속 암기 + 복습으로 기억 유지"의 후반부를 구성하는 핵심 메커니즘. Phase 1의 단발 복습을 Leitner box SRS로 확장한다.

#### 상태 머신

기존 [nv2_stage_progress](../../app/features/v2/progress/schema.ts) 테이블 재사용 (신규 테이블 없음). Nudge와 동일한 vocabulary 사용 — `review_status` enum (`none / r1~r4_pending / mastered`), `review_round` (1~4), `retry_count`.

```
첫 미션에서 stage 노출
├─ 기억함 (step 1 [기억함])   → r2_pending, schedule +3일,  retry_count=0
└─ 기억못함 (step 5 소진)      → r1_pending, schedule +1일,  retry_count=1

복습 DM/이메일 → /hyper-sync/review
├─ step 1 [기억함] (pass)      → next round: r1→r2→r3→r4→mastered
│                                  스케줄 인터벌: 3 / 7 / 14 일 (mastered는 schedule 없음)
└─ step 2+ [기억함] OR step 5 소진 (fail)
                                → r1_pending, schedule +1일, retry_count++

세션 재실패 (이미 pending인 stage)
                                → 기존 schedule 취소 + r1_pending 강등 + 새 schedule +1일, retry_count++

mastered + 기억못함 (세션)     → r1_pending 강등 + 새 schedule +1일, retry_count++ (SRS 재진입)
mastered + 기억함 (세션)       → no-op (verdict만 로그)

retry_count ≥ 3                → calcNextReviewAt halving 적용 (Nudge 정렬). box 1은 floor 1일 유지.
```

#### Pass/Fail 기준 (SRS-1 엄격 — 결정 사항)

- **Pass**: step 1에서 즉시 [기억함] 클릭. 진정한 회상력만 인정.
- **Fail**: 그 외 모두 (step 2~5에서 [기억함] OR step 5 [기억못함]으로 소진).

기존 review 페이지의 5-step retry 로직은 그대로 유지하되, **step 1 외 통과는 SRS pass가 아님**.

#### 인터벌 계산

[intervalDaysForRound(round, retryCount)](../../app/features/v2/hyper-sync/lib/queries.server.ts) — `REVIEW_INTERVALS_DAYS = { 1:1, 2:3, 3:7, 4:14 }` 를 기반으로 retry_count≥3이면 절반 (box 1은 floor 1).

scheduled_at은 [nextMorningInDays(tz, 9, intervalDays)](../../app/features/v2/hyper-sync/lib/session-logic.ts) — 사용자 timezone의 N일 후 09:00 UTC ISO.

#### 결정 사항 요약 (SRS-1 ~ SRS-8)

| ID | 결정 |
|---|---|
| SRS-1 | Pass = step 1 [기억함]만 (엄격) |
| SRS-2 | 재실패 시 refresh — 기존 schedule 취소 + r1 강등 |
| SRS-3 | 익명 사용자 progress 없음 (발송 채널 부재) |
| SRS-4 | Phase 1 데이터 backfill 없음, 새 enqueue부터 SRS |
| SRS-5 | mastered = SRS 알림 종료, 미션 노출 유지. mastered + 기억못함 → r1 강등 |
| SRS-6 | retry_count≥3 halving 적용 (Nudge 정렬) |
| SRS-7 | 첫 세션 [기억함] → r2_pending (+3일) |
| SRS-8 | 표준 1/3/7/14 인터벌, 시작 box 차이로만 차등 |

#### 구현 산출물 (Phase 2)

- [queries.server.ts](../../app/features/v2/hyper-sync/lib/queries.server.ts): `intervalDaysForRound`, `getStageProgressByStageIds`, `cardIdsToStageIds`, `cancelPendingSchedulesForCards`, `applyHyperSyncSessionOutcomes`, `applyHyperSyncReviewOutcomes`, `getHyperSyncReviewSchedules`, `markHyperSyncReviewsOpened`
- [session-logic.ts](../../app/features/v2/hyper-sync/lib/session-logic.ts): `nextMorningInDays`, `chunkArray` 추가
- [api/enqueue-review.tsx](../../app/features/v2/hyper-sync/api/enqueue-review.tsx): 모든 verdict (known + unknown) 수신, applyHyperSyncSessionOutcomes 호출
- [api/record-review-outcome.tsx](../../app/features/v2/hyper-sync/api/record-review-outcome.tsx) (신규): 복습 결과 수신, applyHyperSyncReviewOutcomes 호출
- [review-page](../../app/features/v2/hyper-sync/screens/hyper-sync-review-page.tsx): 멀티 schedule URL 지원 (?ids=...), per-stage verdict 추적, **10개씩 청크 페이지네이션**, 완료 시 POST
- [session-page](../../app/features/v2/hyper-sync/screens/hyper-sync-session-page.tsx): outcomes payload (known + unknown 모두 포함)
- [discord.server.ts](../../app/features/v2/auth/lib/discord.server.ts) / [email.server.ts](../../app/features/v2/auth/lib/email.server.ts): `review_round` 파라미터 추가 → "복습 N회차" 표시
- [dispatch.tsx](../../app/features/v2/cron/api/dispatch.tsx): **사용자별 hyper_sync_review 묶음 발송** + `schedule.review_round` 를 senders에 전달. `?schedule_id=N` force 모드는 단건 발송 유지 (회귀 테스트용)
- [routes.ts](../../app/routes.ts): `/hyper-sync/review` (multi-id query) 추가, 기존 `/hyper-sync/review/:scheduleId` 유지 (legacy DM backward compat)
- 단위 테스트: `tests/hyper-sync-srs.test.ts` (intervalDaysForRound, nextMorningInDays), `tests/hyper-sync-session-logic.test.ts` (chunkArray)

---

## 7. DB 쿼리

```typescript
// app/features/v2/hyper-sync/lib/queries.server.ts

// 미션 목록
export async function getHyperSyncMissions(client: SupabaseClient, productSlug: string) {
  // nv2_learning_products.slug = productSlug
  // → nv2_product_sessions (is_active=true, display_order ASC)
  // → 각 session의 stage count
  // 반환: { product, missions: [{ id, name, stageCount }] }
}

// 세션 카드 로드
export async function getHyperSyncCards(
  client: SupabaseClient,
  sessionId: string
): Promise<CardEntry[]> {
  // nested select:
  //   nv2_stages.session_id = sessionId
  //     → nv2_cards (card_type IN ('title','example'), is_active=true)
  // stage별로 title과 example를 짝지어 CardEntry[]로 반환
  // 서버에서 Fisher-Yates shuffle 수행
}

// 결과 저장 (upsert)
export async function saveHyperSyncResult(
  adminClient: SupabaseClient,
  params: {
    authUserId: string;
    productId: string;
    sessionId: string;
    cardId: string;
    result: "known" | "unknown";
    sessionDate: string;  // 'YYYY-MM-DD' KST 기준
  }
): Promise<void> {
  // ON CONFLICT (auth_user_id, card_id, session_date)
  //   result = EXCLUDED.result,
  //   known_count = nv2_hyper_sync_results.known_count + (result='known' ? 1 : 0)
}

// 복습 enqueue — 로그인 사용자 only
export async function enqueueHyperSyncReview(
  adminClient: SupabaseClient,
  params: {
    authUserId: string;       // 'anon:'으로 시작하면 호출 측에서 차단
    productSlug: string;
    sessionId: string;
    unknownCardIds: string[];
    timezone: string;         // nv2_profiles.timezone
    origin: string;           // request origin for delivery_url
  }
): Promise<{ scheduleId: bigint | null }> {
  if (params.authUserId.startsWith("anon:")) return { scheduleId: null };
  if (params.unknownCardIds.length === 0)    return { scheduleId: null };

  // 1. 기존 pending hyper_sync_review 행 조회 → 이미 예약된 card_id 제외
  // 2. 제외 후 남은 card_id가 0이면 INSERT 스킵
  // 3. message_body = `hyper_sync|${slug}|${sessionId}|${ids.join(',')}|${ids.length}`
  // 4. scheduled_at = nextMorningAt(timezone, 9)  ← §3.4의 신규 헬퍼
  // 5. delivery_url = `${origin}/hyper-sync/review/{scheduleId}` (INSERT 후 PK로 update)
}
```

---

## 8. Acceptance Criteria

### Task 1: 미션 선택 페이지 (`/hyper-sync`)

- **AC-1-1** 로그인 없이 `/hyper-sync` 접근 가능. 미션 목록 표시.
- **AC-1-2** 미션은 `nv2_product_sessions.display_order` 기준 오름차순 표시.
- **AC-1-3** `is_active=false`인 session은 목록에 표시되지 않음.
- **AC-1-4** 각 미션 카드에 미션명, 카드 수, 예상 소요 시간(3분)이 표시.
- **AC-1-5** [시작하기] 클릭 시 `/hyper-sync/session?productId=...&sessionId=...`로 이동.

### Task 2: 미션 진행 — 카드 흐름

- **AC-2-1** 카드 앞면 노출 시 TTS가 자동 1회 재생됨. 영어 카드는 `en-US`, 역방향 카드(앞면이 한국어)는 `ko-KR`.
- **AC-2-2** 앞면 노출 2초 후 뒷면과 버튼이 자동으로 등장.
- **AC-2-3** 뒷면 노출 후 3초 내 무응답 시 자동 '기억못함' 처리.
- **AC-2-4** '기억함' 클릭 시 초록 플래시, '기억못함' 클릭 시 붉은 흔들림 애니메이션 0.4초 후 다음 카드.
- **AC-2-5** 카드 전환 시 이전 TTS가 즉시 중단됨.
- **AC-2-6** 10장 모두 처리 후 결과 화면으로 전환.

### Task 3: 5-Step 복습 로직

- **AC-3-1** '기억못함' 판정된 카드는 retryQueue에 추가되어 다음 일반 카드보다 먼저 표시.
- **AC-3-2** step 1/5는 title 정방향, step 2/4는 title 역방향, step 3은 example 카드로 표시.
- **AC-3-3** example 카드가 없으면 step 3이 title 정방향으로 대체.
- **AC-3-4** 복습 중 '기억함' 클릭 시 남은 step을 스킵하고 즉시 다음으로 이동.
- **AC-3-5** 복습 결과는 최종 집계(전체/기억함/기억못함)에 포함되지 않음.
- **AC-3-6** 복습 중 진행 텍스트는 "복습 N/5 · 단어" / "복습 N/5 · 역방향" / "복습 N/5 · 예문" 형식.

### Task 4: 결과 화면

- **AC-4-1** 전체/기억함/기억못함 카운트가 정확하게 표시.
- **AC-4-2** 기억못함 목록에 표현(front)과 의미(back)이 함께 표시.
- **AC-4-3** 익명 상태에서는 "로그인하고 Discord로 복습 받기" CTA 표시.
- **AC-4-4** 로그인 + Discord 연동 + 기억못함 ≥ 1: 복습 예약 완료 메시지 표시. DB `nv2_schedules`에 `hyper_sync_review` row 1개 생성.
- **AC-4-5** 로그인 + Discord 미연동: "Discord 연결" CTA 표시.
- **AC-4-6** [다음 미션] 클릭 시 `display_order` 기준 다음 `session_id` 진행 화면으로 이동. 마지막 미션이면 `/hyper-sync`로 이동.
- **AC-4-7** [처음으로] 클릭 시 `/hyper-sync`로 이동.

### Task 5: Discord 복습 발송

- **AC-5-1** dispatch cron이 `hyper_sync_review` 타입 schedule을 픽업하여 Discord DM 또는 이메일로 발송.
- **AC-5-2** `scheduled_at`은 사용자 `nv2_profiles.timezone` 기준 **다음 캘린더일 09:00** (UTC ISO). 완료 시각이 오후/저녁이어도 같은 날 발송되지 않음.
- **AC-5-3** 채널 우선순위: Discord 연동 시 DM, 미연동/구독해제 시 이메일 폴백. 양쪽 모두 사용 불가일 때만 skip 처리 (`status='sent'`).
- **AC-5-4** 같은 사용자에게 같은 카드가 중복 pending되지 않음 (enqueue dedup).

### Task 6: 복습 페이지 (`/hyper-sync/review/:scheduleId`)

- **AC-6-1** Discord DM의 버튼 클릭 시 `/hyper-sync/review/:scheduleId`로 진입.
- **AC-6-2** schedule 소유자(로그인 사용자) 외에는 접근 불가 (RLS).
- **AC-6-3** message_body의 카드들을 5-step 복습 로직으로 진행.
- **AC-6-4** 진입 시 `nv2_schedules.opened_at` 업데이트.

### Task 7: 익명 세션

- **AC-7-1** 첫 방문 시 `anon:<uuid>` 형식 anonymous_id가 생성되고 localStorage에 저장.
- **AC-7-2** 재방문 시 기존 anonymous_id 재사용.
- **AC-7-3** 세션 결과가 `nv2_hyper_sync_results.auth_user_id`에 anonymous_id로 저장.
- **AC-7-4** 익명 사용자에게는 `nv2_schedules` row가 생성되지 않음.

---

## 9. Test Plan (수동 TC)

### TC-HS-01: 미션 목록 — 익명 접근
- **선행**: localStorage 초기화
- **절차**: `/hyper-sync` 접근
- **기대**: 로그인 없이 미션 목록 표시. anonymous_id가 localStorage에 생성.

### TC-HS-02: 미션 목록 — 표시 순서
- **선행**: DB에 미션 3개 이상 (`developer-english` 상품)
- **절차**: `/hyper-sync` 접속
- **기대**: 미션명, 10개, 3분 표시. `display_order` 오름차순.

### TC-HS-03: 미션 시작 — 카드 로드
- **선행**: 미션 1개에 stage 10개, 각 stage에 title+example 카드 존재
- **절차**: 미션 [시작하기] 클릭
- **기대**: 세션 화면 진입, 첫 카드 앞면 + TTS 재생.

### TC-HS-04: 앞면 자동 대기
- **선행**: 세션 진행 중
- **절차**: 카드 앞면 노출 후 무동작
- **기대**: 2초 후 뒷면과 버튼 자동 등장.

### TC-HS-05: 타이머 자동 '기억못함'
- **선행**: 뒷면 노출
- **절차**: 3초 동안 버튼 안 누름
- **기대**: 자동 '기억못함' 처리, 붉은 흔들림, retryQueue 추가.

### TC-HS-06: 5-Step 복습 순서
- **선행**: 세션 진행 중
- **절차**: 카드 1장에 '기억못함' → 이후 표시되는 복습 step 확인
- **기대**:
  - step 1: title 정방향, TTS 영어
  - step 2: title 역방향 (의미가 앞면), TTS 한국어
  - step 3: example 카드 (예문이 앞면), TTS 영어
  - step 4: title 역방향, TTS 한국어
  - step 5: title 정방향, TTS 영어

### TC-HS-07: 복습 중 '기억함' 즉시 통과
- **선행**: 복습 step 2 진행 중
- **절차**: '기억함' 클릭
- **기대**: step 3~5 스킵, 다음 일반 카드로 이동.

### TC-HS-08: example 없는 카드 step 3 대체
- **선행**: example 카드가 없는 stage 1개
- **절차**: 해당 카드 '기억못함' → step 3 확인
- **기대**: title 정방향 카드 표시.

### TC-HS-09: 결과 집계 정확성
- **선행**: 미션 1개 완료
- **절차**: 기억함 7, 기억못함 3 처리 후 결과 화면
- **기대**: 전체 10 / 기억함 7 / 기억못함 3. 복습 결과는 미포함.

### TC-HS-10: 결과 화면 — 익명 CTA
- **선행**: 익명 상태
- **절차**: 미션 완료
- **기대**: "로그인하고 Discord로 복습 받기" CTA 표시.

### TC-HS-11: 결과 화면 — 로그인 + Discord 연동
- **선행**: Discord 연동된 로그인 사용자, 기억못함 3개
- **절차**: 미션 완료
- **기대**: "내일 아침 Discord로 복습 예약됨" 메시지. DB `nv2_schedules`에 type='hyper_sync_review' row 1개 생성. `scheduled_at`이 사용자 timezone 기준 다음날 09:00.

### TC-HS-12: Discord DM 발송 (수동 트리거)
- **선행**: 위 TC-HS-11 직후 schedule row 존재
- **절차**: `POST /api/v2/cron/dispatch?schedule_id=N` 호출 (CRON_SECRET 필요)
- **기대**: 테스트용 Discord 계정에 복습 DM 수신. `status='sent'`, `sent_at` 업데이트.

### TC-HS-13: 복습 페이지 진입
- **선행**: TC-HS-12 DM 수신
- **절차**: DM의 버튼 클릭
- **기대**: `/hyper-sync/review/:scheduleId` 진입. 3개 카드 복습 시작. schedule `opened_at` 업데이트.

### TC-HS-14: 다음 미션 이동
- **선행**: 결과 화면 표시 상태
- **절차**: [다음 미션] 클릭
- **기대**: `display_order` 기준 다음 session의 진행 화면으로 이동. 마지막 미션이면 `/hyper-sync`로 이동.

### TC-HS-15: 중복 enqueue 방지
- **선행**: TC-HS-11로 카드 A,B,C가 이미 pending
- **절차**: 같은 사용자가 다른 미션에서 카드 B,C,D를 '기억못함'
- **기대**: 신규 schedule은 카드 D만 포함하거나, 새 row INSERT가 skip됨 (구현 선택).

---

## 10. Vitest 통합 테스트

```
app/features/v2/hyper-sync/__tests__/
├── session-logic.test.ts   ← 순수 함수 단위 테스트
├── message-body.test.ts    ← 직렬화/파싱
└── queries.test.ts         ← DB 쿼리 (test DB)
```

### session-logic.test.ts

```typescript
describe("getRetryCard", () => {
  it("step 1: title 정방향", () => { ... });
  it("step 2: title 역방향 (front/back 교환)", () => { ... });
  it("step 3: example 카드", () => { ... });
  it("step 3: example null이면 title 정방향", () => { ... });
  it("step 4: title 역방향", () => { ... });
  it("step 5: title 정방향", () => { ... });
});
```

### message-body.test.ts

```typescript
describe("hyper_sync message_body", () => {
  it("serialize: card_ids 쉼표 구분", () => { ... });
  it("parse: 정상 입력", () => { ... });
  it("parse: 잘못된 입력 → null 반환", () => { ... });
});
```

### queries.test.ts

```typescript
describe("saveHyperSyncResult", () => {
  it("신규 result 저장", () => { ... });
  it("같은 카드+날짜 upsert: known_count 누적", () => { ... });
  it("result=unknown이면 known_count 변화 없음", () => { ... });
});

describe("enqueueHyperSyncReview", () => {
  it("정상 enqueue", () => { ... });
  it("anon: 사용자는 skip", () => { ... });
  it("unknownCardIds 비어있으면 skip", () => { ... });
  it("중복 pending card_id 제외", () => { ... });
  it("scheduled_at = nextMorningAt(tz, 9)", () => { ... });
  it("nextMorningAt: 23:30 KST 완료 → 다음날 09:00 KST (9.5h 갭)", () => { ... });
  it("nextMorningAt: 02:00 KST 완료 → 다음 캘린더일 09:00 KST (31h 갭)", () => { ... });
});
```

---

## 11. GitHub Actions

`.github/workflows/test.yml` (또는 기존 워크플로우에 path filter 추가)

```yaml
on:
  push:
    paths:
      - 'app/features/v2/hyper-sync/**'
      - 'app/features/v2/schedule/schema.ts'
      - 'app/features/v2/cron/api/dispatch.tsx'
      - 'app/features/v2/auth/lib/discord.server.ts'
```

`npm run test -- app/features/v2/hyper-sync` 실행.

---

## 12. 기존 패턴 참고 (Claude Code 필독)

### Supabase 서버 클라이언트 (v2.0 교정)

```typescript
import makeServerClient from "~/core/lib/supa-client.server";

const [client] = makeServerClient(request);
const { data: { user } } = await client.auth.getUser();  // getSession() 금지
```

### Admin client (RLS 우회)

```typescript
const { createClient } = await import("@supabase/supabase-js");
const adminClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

### loader 데이터 접근

```typescript
const data = useLoaderData<typeof loader>();  // Route.ComponentProps 사용 금지
```

### Supabase 에러 throw

```typescript
if (error) throw new Error(error.message);  // throw error 금지
```

### Enum 컬럼 비교

```typescript
// PostgREST `.eq("status", "active")`은 작동하나, RPC/raw SQL에서
// enum 컬럼을 text와 비교할 때는 `::text` 캐스트 필요
// 예: status::text = 'active'::text
```

---

## 13. 구현 순서

```
0. 시드 데이터 준비:
   - 관리자 화면에서 product slug='developer-english' 등록
   - session 3개 이상 (미션) 등록
   - 각 session에 stage 10개 + 카드(title+example) 등록

1. schema.ts 작성 (nv2_hyper_sync_results)
2. schedule/schema.ts 수정 (enum에 hyper_sync_review 추가)
3. npm run db:generate → npm run db:migrate

4. message-body.ts (직렬화/파싱) + 테스트
5. session-logic.ts (getRetryCard) + 테스트
6. queries.server.ts (getMissions, getCards, saveResult, enqueueReview) + 테스트

7. discord.server.ts — sendHyperSyncReviewDm 추가
8. dispatch.tsx — hyper_sync_review 분기 추가

9. /hyper-sync 미션 선택 페이지
10. /hyper-sync/session 진행 페이지 (5-step 복습 포함)
11. /api/v2/hyper-sync/save-result, /enqueue-review action 엔드포인트
12. /hyper-sync/review/:scheduleId 복습 페이지
13. routes.ts 등록 (파일 생성 후)

14. 수동 TC 검증 (TC-HS-01 ~ TC-HS-15)
15. 회귀 체크리스트 H 섹션 추가 (별도 PR)
```

---

## 14. 샘플 HTML 참고

`hyper-sync-sample.html` / `hyper-sync-demo.html` (첨부)에 완전한 동작 프로토타입.

다음 함수를 그대로 이식한다.

| 함수 | 설명 | 비고 |
|---|---|---|
| `getRetryCard()` | step별 카드 결정 | `session-logic.ts`로 이전 |
| `recordResult()` | 판정 처리 + retryQueue 관리 | 그대로 이식 |
| `renderCard()` | 카드 렌더링 타이밍 | React state로 변환 |
| `speakWord()` / `speakWordLang()` | TTS 언어 감지 | 기존 `_tts_gen` 패턴으로 대체 + 정규식 휴리스틱 제거 |

---

## 15. MVP 성공 기준

- 30명 이상이 미션을 끝까지 완료
- 20명 이상이 Discord 복습 CTA를 클릭
- 10명 이상이 다음 날 복습 DM을 클릭하여 진입
- 5명 이상이 "도움됐다"고 응답
- 반복 사용자 10명 이상

---

## 16. 콘텐츠 작성 원칙

### 수집 방침
AI에게 창작시키지 않는다.

1. GitHub PR, 오픈소스 문서, 기술 면접 영상에서 실제 표현 수집
2. AI와 함께 핵심 표현 정리
3. 직접 최종 검수
4. 관리자 화면에서 session/stage/card 단위로 등록

### 카드 타입 비율 (권장)
- word: 30%
- chunk: 50%
- sentence: 20%

### 좋은 카드 예시

```json
{ "card_type": "title", "front": "reduce latency", "back": "지연 시간을 줄이다" }
{ "card_type": "example", "front": "We reduced latency by caching frequently accessed data.", "back": "자주 접근하는 데이터를 캐싱해서 지연 시간을 줄였다." }
```

### 나쁜 카드 예시

```json
{ "card_type": "title", "front": "ubiquitous", "back": "어디에나 있는" }
```
이유: 개발자 실무 빈도 대비 효용이 낮음. 기술 영어 미션 목적과 맞지 않음.

---

## 17. 회귀 체크리스트 H 섹션 (별도 PR로 추가)

`docs/ops/post-deploy-regression.md`에 추가될 항목 — Phase 1 결정 반영 후 최종본:

| # | 항목 | 절차 | 기대 결과 |
|---|---|---|---|
| H-01 | 익명 미션 목록 | localStorage 초기화 후 `/hyper-sync` 접속 | 로그인 없이 목록 표시, anonymous_id 생성 |
| H-02 | 비활성 미션 숨김 | 관리자에서 미션 1개 비활성화 후 재접속 | 해당 미션이 사라짐 |
| H-03 | 미션 시작 + 카드 진행 | 첫 미션 시작 | 1번 카드 앞면 + TTS, 2초 후 뒷면 + 버튼 |
| H-04 | 타이머 자동 unknown | 뒷면 노출 후 3초 무동작 | 자동 '기억못함' 처리 |
| H-05 | 5-step 복습 순서 | 카드 1개 '기억못함' 후 흐름 관찰 | step 1→2→3→4→5 순서, TTS 언어 일치 |
| H-06 | 복습 중 '기억함' 즉시 통과 | 복습 step 2 진행 중 '기억함' | step 3~5 스킵 |
| H-07 | 결과 화면 — 익명 | 익명으로 미션 완료 | 카운트 정확, "로그인하면 Discord 복습" CTA |
| H-08 | 결과 화면 — 로그인 | Discord 연동 계정으로 완료 (기억못함 ≥ 1) | "복습 예약 완료" 메시지. DB `nv2_schedules` row 1개 생성 |
| H-09 | scheduled_at timezone | TC-HS-11 후 DB 확인 | `scheduled_at` = 사용자 timezone **다음 캘린더일 09:00**의 UTC. 완료 시각이 오후/저녁이어도 같은 날 발송 시각이 잡히지 않음 |
| H-10a | DM 발송 (Discord 연동 계정, 수동 트리거) | 테스트 계정 schedule을 `?schedule_id=N`으로 dispatch | Discord DM 수신, status='sent' |
| H-10b | 이메일 폴백 (Discord 미연동 계정, 수동 트리거) | 이메일만 있는 테스트 계정 schedule을 `?schedule_id=N`으로 dispatch | 이메일 수신, status='sent' |
| H-11 | 복습 페이지 진입 | DM 버튼 클릭 | `/hyper-sync/review/:scheduleId` 진입, opened_at 업데이트 |
| H-12 | 다음 미션 이동 | 결과 화면 [다음 미션] | display_order 다음 session으로 이동 |
| H-13 | 중복 enqueue 방지 | 같은 카드를 다른 미션에서 '기억못함' | 중복 schedule row 생성 안 됨 |

### 회귀 운영 정책

- Hyper-Sync 관련 항목 Fail 시 **전체 롤백 대신 feature flag로 차단**.
- 그러려면 `ENABLE_HYPER_SYNC=true` 환경변수로 loader 단에서 redirect 게이트 적용 (구현 시 함께 작업).
- 기존 A~G 섹션 Fail은 현행 정책 그대로 (즉시 롤백 검토).

### 예상 추가 소요

- 기존 15분 + H 섹션 ~10분 = **25분**
- 문서 헤더 "약 15분" → "약 25분"으로 갱신

---

*이 문서는 Claude Code가 구현 컨텍스트 없이 독립적으로 읽고 구현할 수 있도록 작성되었다.*
*변경 사항은 §0.1 변경 로그에 추가하고 버전을 올린다.*
