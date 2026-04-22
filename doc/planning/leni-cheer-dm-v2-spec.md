# Leni Cheer DM v2 — 기획 및 설계 문서

**작성일**: 2026-04-21  
**상태**: 설계 확정. 구현 대기.  
**구현 담당**: Claude Code

---

## 1. 배경 및 목표

### 현재 문제

현재 Leni cheer DM은 `NUDGE_MESSAGES` 상수에 정의된 4종 고정 템플릿 중 랜덤 발송이다.
하루 5회(09:00 / 11:30 / 14:00 / 17:30 / 21:00) 발송되지만 다음 문제가 있다.

- 사용자가 패턴을 금방 인지 → "또 그 메시지"로 처리 → 개봉률 저하
- 학습 내용과 완전히 분리된 메시지 → 학습 동기 유발 없음
- 이미 세션을 완료한 사용자에게도 "아직 안 하셨죠?" 발송 → 신뢰 저하
- 발송 횟수 과다 → 알림 피로 유발

### 목표

1. **방문 유도**: 사용자가 링크를 클릭해 세션으로 진입하게 만든다
2. **DM 내 학습**: 클릭하지 않아도 DM 자체로 단어/표현을 하나라도 기억하게 만든다
3. **상황 맞춤**: 세션 완료 여부에 따라 완전히 다른 메시지를 발송한다

> "도움 안 되는 메시지 4개보다 정말 도움되는 메시지 1건이 낫다"

---

## 2. 변경 사항 개요

| 항목 | 현재 | 변경 후 |
|---|---|---|
| 발송 횟수 | 하루 5회 | 하루 2회 (오전 + 저녁) |
| 메시지 생성 | 고정 템플릿 랜덤 선택 | AI 개인화 생성 (OpenAI gpt-4o-mini) |
| 메시지 내용 | 응원 문구만 | 응원/칭찬 + 학습 콘텐츠 미리보기 포함 |
| 완료/미완료 분기 | 없음 | dispatch 발송 직전 세션 상태 재확인 후 분기 |
| 처리 주체 | Supabase Cron `enqueue-nudge` | n8n 워크플로우 (큐 등록) + Supabase Cron `dispatch` (발송) |

---

## 3. 발송 슬롯 변경

### 변경 전 (`NUDGE_SCHEDULE_TIMES`, 5개)

```typescript
{ hour: 9,  minute: 0  }   // 09:00
{ hour: 11, minute: 30 }   // 11:30
{ hour: 14, minute: 0  }   // 14:00
{ hour: 17, minute: 30 }   // 17:30
{ hour: 21, minute: 0  }   // 21:00
```

### 변경 후 (2개)

```typescript
{ hour: 9,  minute: 0  }   // 09:00 — 오전 슬롯
{ hour: 19, minute: 0  }   // 19:00 — 저녁 슬롯 (17:30 → 19:00으로 변경, 저녁식사 후 시간대)
```

> **슬롯 타입**: `hour === 9` → `"morning"`, `hour === 19` → `"evening"`  
> 슬롯 타입은 n8n에서 프롬프트 분기에 활용된다 (아래 §6 참조)

---

## 4. 아키텍처

### 전체 흐름

```
[n8n Workflow — 하루 2회 실행]
  발송 2시간 전 실행 (오전 슬롯: 07:00 KST 기준 UTC 환산, 저녁 슬롯: 17:00 KST 기준)
  → 1. 미완료 세션 보유 사용자 조회 (Supabase)
  → 2. 사용자별 학습 콘텐츠 조회 (상품 유형별 분기)
  → 3. OpenAI 호출 → incomplete_message + complete_message 동시 생성
  → 4. nv2_schedules INSERT
       (scheduled_at = 사용자 로컬 발송 시각으로 계산)

[Supabase Cron dispatch — 5분 간격, 기존 그대로]
  → pending cheer 행 발견
  → 해당 사용자 세션 상태 DB 재확인 (발송 직전)
  → status = 'completed'  → complete_message 발송
  → status != 'completed' → incomplete_message 발송
```

### 핵심 설계 원칙

- **n8n**: 메시지 생성 + 큐 등록 전담. 타임아웃 제약 없음.
- **dispatch**: 발송 전담. 발송 직전 세션 상태를 재확인하여 상태 역전(생성 후 완료) 대응.
- **Wait 노드 불필요**: 상태 재확인을 dispatch에 위임하므로 n8n에서 대기 로직 없음.
- **n8n 실행 횟수**: 하루 2회 → 월 60회. Starter 플랜(월 2,500회) 내 충분히 여유 있음.

---

## 5. message_body 포맷 확장

### 신규 포맷 (`|||` 구분자로 두 메시지 포함)

```
cheer:HH|product_name|session_label|incomplete_message|||complete_message
```

- `cheer:HH` — 슬롯 시각 (중복 방지 dedup 키로 활용, 기존 동일)
- `product_name` — 상품명 (예: "Deutsch A1")
- `session_label` — 세션 레이블 (예: "Session 14")
- `incomplete_message` — 세션 미완료 사용자에게 발송할 메시지
- `|||` — 두 메시지 블록 구분자 (`|` 단일 구분자와 충돌 방지)
- `complete_message` — 세션 완료 사용자에게 발송할 메시지

### 레거시 포맷 (기존, 하위 호환 유지)

```
cheer:HH|product_name|session_label|message
```

`|||`가 없으면 레거시 포맷으로 판별하여 기존 방식 그대로 처리한다.

---

## 6. n8n 워크플로우 설계

### 트리거

- **Schedule Trigger**: 하루 2회
  - 오전 슬롯용: UTC 00:00 (KST 09:00 기준 2시간 전인 KST 07:00 = UTC 22:00 전날)
  - 저녁 슬롯용: UTC 10:00 (KST 19:00 기준 2시간 전인 KST 17:00 = UTC 08:00)
  - ※ 실제 UTC 시각은 서비스 주요 사용자 타임존에 맞춰 조정. `scheduled_at`을 사용자별로 계산하므로 n8n 트리거 시각은 "가장 이른 타임존 사용자의 발송 2시간 전"으로 설정하면 됨.
  - ※ 각 트리거에 `slot_type` 파라미터 세팅: `"morning"` / `"evening"`

### 노드 구성

```
[1] Schedule Trigger
      ↓
[2] Supabase: 미완료 세션 사용자 조회
      nv2_sessions JOIN nv2_product_sessions JOIN nv2_learning_products
      WHERE status IN ('pending', 'in_progress')
      + nv2_profiles (discord_id, display_name, timezone)
      + nv2_subscriptions (is_active = true)
      dedup by auth_user_id (user당 1개 세션만)
      ↓
[3] Supabase: 사용자별 완료 세션 수 조회
      SELECT COUNT(*) FROM nv2_sessions
      WHERE auth_user_id = ? AND status = 'completed'
      ↓
[4] Code: 학습 콘텐츠 조회 준비 (상품 유형 판별)
      product.meta.story 존재 여부 → story 상품 분기
      그 외 → 일반 learning 카드 분기
      ↓
[5] Supabase: 학습 콘텐츠 조회
      nv2_product_session_stages
        → nv2_stages (stage_type = 'learning')
        → nv2_cards (card_type IN ('title', 'description', 'example'))
      사용자가 아직 완료하지 않은 stage 우선 (nv2_stage_progress.completed_at IS NULL)
      랜덤 2~3개 추출
      story 상품: nv2_cards.card_data.hook_text 사용
      ↓
[6] Code: OpenAI 프롬프트 조합
      (아래 §6-1 참조)
      ↓
[7] OpenAI: gpt-4o-mini 호출
      API Key: OPENAI_API_SECRET_NUDGE_LENI_CHAT (기존 Leni 채팅과 동일)
      JSON 응답: { incomplete_message, complete_message }
      ↓
[8] Code: message_body 조합 + scheduled_at 계산
      message_body = `cheer:${hour}|${product_name}|${session_label}|${incomplete_message}|||${complete_message}`
      scheduled_at = 사용자 timezone 기준 발송 시각을 UTC로 변환
      ↓
[9] Supabase: nv2_schedules INSERT
      auth_user_id, schedule_type='cheer', delivery_url, message_body, scheduled_at, status='pending'
```

### 6-1. OpenAI 프롬프트

**System prompt:**

```
You are Leni, a 15-year-old German girl who studies languages alongside the user.
Tone: warm, bright, slightly playful. Korean 해요체 (존댓말). Plain text only, no markdown.
Max 1~2 emojis per message. Each message max 4 lines.
Respond ONLY with a JSON object containing exactly two keys: incomplete_message, complete_message.
No preamble, no explanation, no code fences. Just the raw JSON.
```

**User prompt (런타임 조합):**

```
사용자 정보:
- 이름: {display_name}
- 학습 상품: {product_name}
- 오늘 세션: {session_label}
- 전체 완료 세션 수: {completed_count}
- 발송 시간대: {slot_type}  // "morning" 또는 "evening"

오늘의 학습 콘텐츠 미리보기:
{preview_lines}
// 예시:
// • ablehnen — 거절하다
// • vereinbaren — 약속을 잡다
// • Unterlagen — 서류, 자료

---

incomplete_message 작성 조건:
- 세션을 아직 시작하지 않은 사용자에게 보내는 메시지
- 위 단어/표현 중 일부를 자연스럽게 포함
- 학습 링크 클릭을 유도하되 강요하지 않음
- 첫 줄이 가장 흥미로운 훅이 되도록

complete_message 작성 조건:
- 이미 오늘 세션을 완료한 사용자에게 보내는 메시지
- slot_type이 "morning"이면: 오늘 배운 내용 중 단어/표현을 활용하는 팁 또는 복습 유도
- slot_type이 "evening"이면: 내일 배울 것을 예고하는 내용 (위 단어들이 내일 나올 것처럼 자연스럽게)
- 칭찬과 기대감을 함께 담을 것
```

**응답 예시:**

```json
{
  "incomplete_message": "민수님, Session 14 아직이시죠? 😏\n오늘 이 단어들 먼저 보고 가요!\n• ablehnen — 거절하다\n• vereinbaren — 약속을 잡다\n딱 여기까지만 알아도 오늘 절반은 한 거예요!",
  "complete_message": "오늘도 완료하셨군요, 정말 멋져요! 🎉\n내일 Session 15에서 배울 것 살짝 예고할게요!\n• kündigen — 해지하다\n• Gehalt — 급여\n내일 DM 받으면 이미 아는 단어가 있을 거예요 😄"
}
```

### 6-2. 학습 콘텐츠 미리보기 — 상품 유형별 분기

모든 상품은 `learning` 스테이지에 `title`/`description`/`example` 카드 구조를 공통으로 사용한다.
상품 유형과 무관하게 동일한 파이프라인으로 처리 가능하다.

| 상품 유형 | 판별 조건 | 미리보기 구성 |
|---|---|---|
| 일반 언어 학습 | `meta.story` 없음 | `title` 카드의 단어 + `description` 카드의 뜻, 2~3개 |
| Story Learning | `meta.story` 있음 | `card_data.hook_text` (챕터 도입부) + 학습 단어 1개 |
| 기술/실무/자격증 (미래) | `category` 등으로 판별 | 동일 구조 — "단어" 라벨을 "핵심 표현"으로만 변경 |

**미리보기 라벨 추상화 원칙:**
- 언어 상품: "오늘의 단어"
- story 상품: "오늘의 이야기 + 단어"
- 기타 상품: "오늘의 핵심 표현" (미래 확장 시 추가)

### 6-3. 중복 방지

기존 `getCronCheerExistsTodayForHour` 로직과 동일하게, n8n INSERT 전에 해당 `auth_user_id` + `cheer:HH` 태그가 오늘 날짜에 이미 존재하는지 확인한다.

---

## 7. dispatch.tsx 변경 사항

### 세션 상태 재확인 + message_body 파싱 로직

기존 cheer 처리 블록을 아래와 같이 교체한다.

```typescript
if (schedule.schedule_type === "cheer") {
  if (!use_discord) {
    await markCronScheduleSent(client as any, schedule_id);
    results.skipped++;
    continue;
  }

  const raw_body = schedule.message_body ?? "";

  // Split into meta part and messages part by ||| separator
  const separator_idx = raw_body.indexOf("|||");
  const has_dual_message = separator_idx !== -1;

  const meta_part = has_dual_message
    ? raw_body.slice(0, separator_idx)
    : raw_body;
  const complete_message_part = has_dual_message
    ? raw_body.slice(separator_idx + 3)
    : null;

  const parts = meta_part.split("|");
  const product_name = parts[1] ?? "";
  const session_label = parts[2] ?? "";
  const incomplete_message = parts.slice(3).join("|");

  let message = incomplete_message;

  if (has_dual_message && complete_message_part !== null) {
    // Re-check session status immediately before sending
    const { data: latest_session } = await client
      .from("nv2_sessions")
      .select("status")
      .eq("auth_user_id", schedule.auth_user_id)
      .not("status", "eq", "pending") // exclude sessions not yet started
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const is_completed = latest_session?.status === "completed";
    message = is_completed ? complete_message_part : incomplete_message;
  }

  await sendCheerDm(
    discord_id!,
    schedule.delivery_url,
    message,
    product_name || undefined,
    session_label || undefined
  );
}
```

> **레거시 호환**: `|||`가 없으면 `has_dual_message = false`로 판별되어 기존 로직(`incomplete_message`를 그대로 사용)으로 동작한다.

---

## 8. sendCheerDm 개선 (discord.server.ts)

단어 미리보기가 이미 `message` 텍스트 안에 포함되어 있으므로, `sendCheerDm` 함수 시그니처 변경은 불필요하다.

embed 구조만 아래와 같이 개선한다.

### 현재

```
content: {message}
embed.title: "📖 학습을 계속해봐요!"
embed.description: "{context}\n아래 버튼을 눌러 이어서 학습하세요."
button: "학습 이어하기 →"
```

### 변경 후

```
content: {message}           ← AI가 생성한 전체 메시지 (단어 미리보기 포함)
embed.title: (없음 또는 최소화)
embed.description: (없음 또는 단순 CTA 1줄)
button: "학습 이어하기 →"
```

메시지 본문이 이미 풍부하므로 embed는 버튼 표시 용도로만 사용한다.
구체적인 embed 구조는 Discord 렌더링 테스트 후 결정한다.

---

## 9. constants.ts 변경 사항

### NUDGE_SCHEDULE_TIMES

```typescript
// 변경 전 (5개 슬롯)
export const NUDGE_SCHEDULE_TIMES = [
  { hour: 9,  minute: 0  },
  { hour: 11, minute: 30 },
  { hour: 14, minute: 0  },
  { hour: 17, minute: 30 },
  { hour: 21, minute: 0  },
] as const;

// 변경 후 (2개 슬롯)
export const NUDGE_SCHEDULE_TIMES = [
  { hour: 9,  minute: 0  },   // morning slot
  { hour: 19, minute: 0  },   // evening slot
] as const;
```

### NUDGE_MESSAGES / getRandomNudgeMessage

`enqueue-nudge`가 n8n으로 이관되므로 더 이상 사용되지 않는다.
**삭제하지 않고 주석 처리**한다.

---

## 10. enqueue-nudge.tsx 처리

n8n으로 완전 이관되므로 `enqueue-nudge.tsx` 라우트는 더 이상 Supabase Cron에서 호출되지 않는다.

- 파일 자체는 **삭제하지 않고 유지**한다 (향후 수동 테스트 등 활용 가능)
- Supabase Cron 대시보드에서 `enqueue-nudge` job을 **비활성화**한다 (코드가 아닌 운영 작업)
- 파일 상단에 주석 추가:

```typescript
/**
 * @deprecated 2026-04-21
 * Superseded by n8n workflow: leni-cheer-dm-v2
 * This route is no longer called by Supabase Cron.
 * Kept for reference and manual testing purposes only.
 */
```

---

## 11. 구현 파일 목록

| 파일 | 변경 유형 | 변경 내용 |
|---|---|---|
| `features/v2/shared/constants.ts` | 수정 | `NUDGE_SCHEDULE_TIMES` 2개 슬롯으로 변경, `NUDGE_MESSAGES` / `getRandomNudgeMessage` 주석 처리 |
| `features/v2/cron/api/dispatch.tsx` | 수정 | cheer 처리 블록: `|||` 파싱 + 세션 상태 재확인 로직 추가 |
| `features/v2/auth/lib/discord.server.ts` | 수정 | `sendCheerDm` embed 구조 개선 (메시지 본문 중심으로) |
| `features/v2/cron/api/enqueue-nudge.tsx` | 수정 | 파일 상단 `@deprecated` 주석 추가 |
| **n8n workflow JSON** | 신규 | `leni-cheer-dm-v2` 워크플로우 (§6 노드 구성 참조) |

> **DB 스키마 변경 없음**: `nv2_schedules.message_body`는 `TEXT` 컬럼이므로 포맷 확장에 마이그레이션 불필요.

---

## 12. 구현 순서 권장

1. `constants.ts` — 슬롯 변경 및 기존 메시지 상수 주석 처리
2. `dispatch.tsx` — cheer 처리 블록 교체 (레거시 호환 포함)
3. `discord.server.ts` — `sendCheerDm` embed 개선
4. `enqueue-nudge.tsx` — deprecated 주석 추가
5. n8n 워크플로우 구성 및 테스트
6. Supabase Cron 대시보드에서 `enqueue-nudge` job 비활성화

---

## 13. 테스트 시나리오

| 시나리오 | 기대 동작 |
|---|---|
| 신규 포맷, 미완료 사용자 | `incomplete_message` 발송 |
| 신규 포맷, n8n 생성 후 완료된 사용자 | dispatch 재확인 → `complete_message` 발송 |
| 레거시 포맷 (기존 큐 잔존 행) | `|||` 없음 → 기존 로직 그대로 동작 |
| OpenAI 호출 실패 (n8n) | n8n 재시도 정책에 따라 처리. 실패 시 해당 사용자 행 INSERT 건너뜀 (발송 없음, 다음 슬롯에서 재시도됨) |
| discord_id 없는 사용자 | 기존과 동일 — cheer skip |

---

## 14. 미결 사항 (구현 시 결정)

| 항목 | 내용 |
|---|---|
| n8n 트리거 정확한 UTC 시각 | 서비스 주요 사용자 타임존 분포 확인 후 결정 |
| `sendCheerDm` embed 최종 구조 | Discord 렌더링 테스트 후 결정 |
| OpenAI 호출 실패 시 fallback | 현재 설계: 해당 사용자 발송 없음. 필요 시 고정 템플릿 fallback 추가 가능 |
| story 상품 `hook_text` 조회 경로 | `nv2_cards.card_data->>'hook_text'` 확인 필요 |
