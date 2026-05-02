# Nudge v2 — Story Learning 기능 기획서

**작성일**: 2026-04-18  
**최종 업데이트**: 2026-05-02  
**상태**: 운영 중 (story-deutsch-b1-snowwhite 시즌 1). Leni 채팅 목표 언어 대화로 전환 완료.  
**관련 문서**: nudge-v2-design-2026-04-20.md

---

## 1. 개요

### 배경

클로즈 베타 테스터 피드백:
- "DM이 자동 반복 내용인 것을 알기 때문에 다시 열어볼 마음이 생기지 않음"
- "AI 시대에 A-Z 단어 카드는 흥미를 끌기 어렵다. 새로운 학습법이 필요하다"

### 핵심 아이디어

매 세션마다 이어지는 소설을 통해 단어를 예습한다. 이야기는 학습자의 모국어(한국어)로 작성하되, 해당 세션의 학습 단어는 반드시 학습 언어(독일어 등)로 삽입한다. 이야기를 타이핑 효과로 한 글자씩 전시하다가 학습 단어가 등장하는 순간 멈추고, 해당 학습 카드를 보여준 후 이야기를 이어간다.

### 포지셔닝

기존 상품: "단어 카드로 공부하는 서비스"  
Story Learning 상품: "매일 이어지는 소설을 읽으며 자연스럽게 단어를 습득하는 서비스"

---

## 2. 상품 구조

### 상품 단위

하나의 Story Learning 상품 = 하나의 이야기 + 하나의 언어/레벨 조합

같은 언어/레벨이라도 이야기가 다르면 별개의 상품이다.  
같은 이야기라도 언어/레벨이 다르면 별개의 상품이다.

**상품 예시**
```
베를린의 신데렐라 × 독일어 B1
뮌헨의 실종자      × 독일어 B1
베를린의 신데렐라 × 독일어 A2   ← 같은 이야기, 다른 레벨 = 별개 상품
마드리드의 형제   × 스페인어 A1
```

### 이야기 소재 전략

- 전래동화/고전 각색 우선: 독자가 줄거리를 이미 알기 때문에 이야기 파악에 인지 자원을 낭비하지 않아도 된다. 저작권 문제 없음.
- 오리지널 스토리: 품질 검증 후 추가

### 세션당 단어 수

기존 상품과 동일하게 세션당 5단어

### 세션 구성

```
[1~5] learning × 5        ← 단어 카드 먼저 학습
[6]   story 스테이지      ← 이야기 속에서 단어 재확인
[7]   quiz_current_session
```

learning 스테이지 5개를 먼저 완료한 후 story 스테이지를 진행한다.  
단어를 먼저 학습한 뒤 이야기에서 다시 만나는 구조로 인출 강도를 높인다.  
learning 스테이지는 B1 원본 상품에서 카드 데이터를 복사하여 독립 생성한다 (stage_id 공유 없음).

---

## 3. 이야기 생성 규칙

### 단어 포함 규칙

| 단어 출처 | 포함 규칙 |
|---|---|
| 이번 세션 5단어 | 반드시 포함 |
| 직전 세션 5단어 | 반드시 포함 |
| 그 이전 세션 단어 | 이야기 흐름상 자연스러운 경우에만 포함 |

### 챕터 길이

고정하지 않는다. 이번 세션 5단어 + 직전 세션 5단어가 모두 자연스럽게 등장할 때까지 이야기를 전개한다. 억지로 짧게 끊지 않는다.

### 언어 혼용 규칙 (Code-switching)

- 이야기 본문: 학습자 모국어(한국어)
- 학습 단어 등장 시: **독일어 단어(한국어 뜻)** 형식으로 표기
- 예: `엘라는 언니들의 부탁을 항상 **ablehnen(거절)했다**.`
- 자연스러운 반복 등장 허용 (오히려 반복 노출이 학습에 유리)

### 챕터 마지막 규칙

반드시 다음 챕터가 궁금해지는 문장(클리프행어)으로 끝낸다.  
DM 개봉률과 직결된다.

---

## 4. n8n 콘텐츠 생성 파이프라인

### 워크플로우 인풋 구조

```json
{
  "system": "너는 언어 학습용 소설 작가입니다. 다음 규칙을 반드시 따르세요: 이야기는 한국어로 작성합니다. 학습 단어는 반드시 포함하고 **독일어(한국어뜻)** 형식으로 표기합니다. 학습 단어는 자연스럽게 등장해야 합니다. 챕터 길이는 단어가 모두 자연스럽게 들어갈 때까지 늘립니다. 이전 챕터와 이야기가 자연스럽게 이어져야 합니다. 챕터 마지막은 다음 챕터가 궁금해지는 문장으로 끝냅니다.",
  "original_story": "신데렐라",
  "setting": "현대 베를린",
  "previous_summary": "엘라는 베를린의 작은 카페에서 일하며 언니들의 구박을 받고 있다. 어느 날 베를린 시청 파티 포스터를 보고 가고 싶었지만 언니들에게 거절당했다. 집으로 돌아와 지쳐 쓰러진 순간 초인종이 울렸다.",
  "current_words": [
    { "word": "abfahren", "meaning": "출발하다" },
    { "word": "ablegen", "meaning": "내려놓다" },
    { "word": "Abend", "meaning": "저녁" },
    { "word": "aber", "meaning": "하지만" },
    { "word": "Abenteuer", "meaning": "모험" }
  ],
  "previous_words": [
    { "word": "ablehnen", "meaning": "거절하다" },
    { "word": "abbiegen", "meaning": "꺾다" },
    { "word": "abmachen", "meaning": "약속하다" },
    { "word": "Abbildung", "meaning": "그림/포스터" },
    { "word": "abnehmen", "meaning": "덜어내다" }
  ]
}
```

### AI 아웃풋 구조

AI가 반환하는 JSON:

```json
{
  "chapter_number": 2,
  "summary": "대모 할머니가 엘라를 찾아와 드레스를 주고 파티에 가도록 격려했다. 택시를 타고 시청에 도착한 엘라는 한 남자와 눈이 마주쳤다.",
  "text": "초인종 소리에 엘라는 천천히 일어났다. 문을 열자 낯선 할머니가 서 있었다. {{Abend|저녁}} 늦은 시간에 찾아온 방문객이 엘라는 조금 놀라웠다.\n\n\"엘라, 나는 네 대모야.\" 할머니가 말했다.\n\n엘라는 어리둥절했다. \"대모요? {{aber|하지만}} 저는 대모가 없는데요.\"\n\n할머니는 웃으며 방 안으로 들어왔다. 그리고 엘라의 낡은 가방을 보며 말했다. \"그 무거운 짐 좀 {{ablegen|내려놓아}} 봐. 오늘 밤은 내가 도와줄게.\"\n\n..."
}
```

### 마커 형식

학습 단어 삽입 위치에 `{{단어|뜻}}` 마커를 사용한다.

```
{{ablehnen|거절하다}}
{{Abend|저녁}}
```

렌더링 시 이 마커를 감지하여 타이핑을 멈추고 학습 카드를 띄운다.

### DB 저장 구조

생성된 챕터는 `nv2_cards` 테이블에 `card_type = 'story'`로 저장한다.

```json
{
  "card_type": "story",
  "card_data": {
    "chapter_number": 2,
    "summary": "대모 할머니가 엘라를 찾아와...",
    "text": "초인종 소리에 엘라는 천천히 일어났다. {{Abend|저녁}} 늦은...",
    "illustration_url": null
  }
}
```

`summary`는 다음 챕터 생성 시 `previous_summary`로 사용된다.  
`illustration_url`은 초기 생성 시 `null`이며, 관리자 화면에서 이미지 링크를 입력하여 추가한다.

---

## 5. DM 발송 개선

### 기존 DM 문제

- 학습 내용과 완전히 분리된 고정 메시지
- "또 그 메시지"로 인식되어 개봉률 저하

### 신규 DM 구조

`enqueue-daily`에서 세션 큐 등록 시, 해당 세션의 story 스테이지 카드에서 도입부 텍스트를 추출하여 DM 메시지에 포함한다.

**4가지 메시지 템플릿 중 랜덤 선택:**

**템플릿 A — 단어 퀴즈 훅**
```
Leni 🌟

"abfahren"... 이거 뭔 뜻인지 아세요? 😏
오늘 이야기에 답이 있어요!

[오늘의 이야기 미리보기]
초인종 소리에 엘라는 천천히 일어났다...

학습 시작 →
```

**템플릿 B — Leni의 오늘 이야기**
```
Leni 🌸

오늘 엘라한테 무슨 일이 생겼는지 아세요? 😮
저도 깜짝 놀랐어요!

[오늘의 이야기 미리보기]
초인종 소리에 엘라는 천천히 일어났다...

학습 시작 →
```

**템플릿 C — 진도 기반**
```
Leni 📖

지난 챕터 기억하세요?
엘라가 초인종 소리를 들었잖아요...
오늘 드디어 문을 열어요!

학습 시작 →
```

**템플릿 D — 문화/언어 팁**
```
Leni 🇩🇪

독일에서는 저녁 인사로 "Guten Abend!" 라고 해요.
오늘 이야기에서 Abend가 어떻게 쓰이는지 볼게요!

학습 시작 →
```

미리보기 텍스트는 story 카드의 `text` 필드 앞부분 약 50자를 사용한다. `{{마커}}`는 미리보기에서 한국어 뜻으로만 표시한다.

---

## 6. 학습 화면 UX (story 스테이지)

### 전체 흐름

```
세션 진입 (/sessions/:sessionId)
→ 학습 목록 화면 (/sessions/:sessionId/list)
  → 챕터 요약 카드 표시 (chapter_title + hook_text + 학습 흐름 3단계)
  → 학습 단계: learning×5 → story → quiz
→ story 스테이지 시작 (/story/:stageId)
  → 첫 번째 문장만 표시
  → 문장 끝 ▼ 아이콘 (bounce 애니메이션) 으로 클릭 유도
  → 클릭 → 다음 문장 표시 (fadeSlideIn 애니메이션)
  → {{단어|뜻}} 마커 포함 문장 도달 시:
      → 단어가 초록색 밑줄 + 깜빡임으로 클릭 유도
      → 클릭 즉시 깜빡임 중단 + TTS 자동 재생 1회
      → 단어 카드 modal 표시
      → "확인했어요" 클릭 → 노란 하이라이트 → 다음 문장 자동 진행
  → 이야기 끝 → "다음 학습으로 →" 버튼
```

### 헤더 컨트롤 (sticky)

| 버튼 | 동작 |
|---|---|
| ← 세션 목록 | /sessions/:sessionId/list 이동 (또는 ✕ 닫기 — 새 탭으로 열린 경우) |
| Auto | ON: 1500ms 간격 자동 진행, 마커 문장에서 일시 정지 / OFF: 중단 |
| Skip | 다음 마커 포함 문장까지 즉시 전시 (없으면 끝까지) |
| ↺ | 첫 문장만 보이는 초기 상태로 리셋 |

### 단어 카드 팝업

```
┌─────────────────────────────┐
│      ablehnen               │
│      [아블레넨]              │
│      🔊 발음 듣기 (자동 재생) │
│  ──────────────────────     │
│      거절하다               │
│  "Sie hat mein Angebot      │
│   abgelehnt."               │
│  (그녀는 내 제안을 거절했다) │
│      [확인했어요 →]         │
└─────────────────────────────┘
```

- 단어 클릭 즉시 TTS 자동 재생 1회
- 한 번 클릭한 단어는 리셋 전까지 깜빡이지 않음 (confirmed 상태)
- 확인 후 노란 하이라이트 표시

### 삽화

`illustration_url`이 있으면 본문 상단에 표시. `null`이면 이미지 영역 없음.

### Leni 채팅 연동

**인트로 (클라이언트 구성, Leni 응답 아님)**:
- 학습 카드 버블 (learning stage 수만큼)
- story 말풍선: 초록 테마, hook_text 미리보기, "챕터 읽기 →" 버튼
- 클릭 시 새 탭으로 story-page 열기 (`?next=close`)
- story 완료 후 탭 자동 닫힘

**Leni 대화 (첫 메시지 전송 이후)**:
- `buildStorySessionPrompt` 적용 — targetLanguage 전용 대화 파트너
- 대화 소재: `meta.story`/`meta.season`/`meta.setting` 기반 챕터 배경·등장인물·세션 단어
- language 상품과 동일한 CRITICAL RULES 1~7 (translation 필드, TTS, Rule 7 등) 적용
- 사용자가 learnerLanguage로 입력 시 해당 입력의 targetLanguage 번역 자동 제공

---

## 7. DB 스키마 변경

### nv2_cards — card_type 추가

기존 card_type enum에 `story` 추가

```typescript
// schema.ts
export const cardTypeEnum = pgEnum('card_type', [
  'word',
  'phrase', 
  'sentence',
  'quiz_5',
  'quiz_10',
  'story',  // 신규 추가
]);
```

card_data JSON 구조 (story 타입):

```typescript
type StoryCardData = {
  chapter_number:   number;        // 챕터 번호
  chapter_title:    string;        // 챕터 제목 (예: "거울의 배신")
  summary:          string;        // 내부 메모 요약 (다음 챕터 생성 시 사용, 마커 없음)
  hook_text:        string;        // 사용자 노출용 후킹 요약 (2~3문장, 마커 없음)
  text:             string;        // 마커 포함 이야기 본문
  illustration_url: string | null; // 삽화 이미지 URL (관리자가 추가, 초기값 null)
  // text 내 마커 형식: {{단어|뜻}}
};
```

### nv2_stages — stage_type 추가

기존 stage_type enum에 `story` 추가

```typescript
export const stageTypeEnum = pgEnum('stage_type', [
  'learning',
  'quiz_current_session',
  'quiz_current_and_prev_session',
  'sentence_practice',
  'dictation',
  'writing',
  'story',  // 신규 추가
]);
```

---

## 8. 새 라우트 및 파일 구조

```
app/features/v2/
└── story/
    ├── screens/
    │   └── story-page.tsx        ← GET /story/:stageId
    └── api/
        └── result.tsx            ← POST /api/v2/story/:stageId/result
```

### story-page.tsx 주요 로직

1. `stageId`로 `nv2_stages` 조회
2. 해당 stage의 `nv2_cards` 중 `card_type = 'story'` 카드 조회
3. card_data.text 파싱: `{{단어|뜻}}` 마커 추출
4. 마커 위치에 연결된 learning 카드 데이터 조회 (단어, 발음, 예문, TTS)
5. 타이핑 + 카드 팝업 UI 렌더링

### story result API

story 스테이지 완료 시 호출. 기존 stage complete API와 동일한 패턴.

```
POST /api/v2/story/:stageId/result
→ nv2_stage_progress 업데이트 (completed_at, review_status = 'completed')
→ { ok: true }
```

---

## 9. n8n 워크플로우 설계

### 기존 워크플로우와의 차이

기존: 단어 카드 생성 (단어별 독립 생성, 순서 무관)  
신규: 챕터 생성 (이전 챕터 요약을 컨텍스트로 순차 생성)

### 워크플로우 노드 구성

```
[Manual Trigger 또는 HTTP Request]
    ↓
[Prepare Story Context]
  - 상품 정보 (원작, 배경, 언어, 레벨)
  - 이번 세션 단어 5개 조회
  - 직전 세션 단어 5개 조회
  - 직전 챕터 summary 조회 (없으면 빈 값 = 1챕터)
    ↓
[Build Story Prompt]
  - 시스템 프롬프트 구성
  - previous_summary, current_words, previous_words 조합
    ↓
[AI Agent (OpenAI GPT-4o)]
  - 챕터 텍스트 생성
  - 반환: { chapter_number, summary, text }
    ↓
[Parse & Validate]
  - {{마커}} 형식 검증
  - current_words 5개 모두 포함 여부 확인
  - 미포함 단어 있으면 재생성 요청
    ↓
[Execute SQL]
  - nv2_cards INSERT (card_type = 'story')
  - nv2_stages INSERT
  - nv2_product_session_stages INSERT
```

### 챕터 summary 관리

각 챕터 생성 시 AI가 반환한 `summary`를 `nv2_cards.card_data.summary`에 저장한다. 다음 챕터 생성 시 이 summary를 `previous_summary`로 사용한다. 전체 텍스트가 아닌 3~5문장 요약만 전달하므로 컨텍스트 길이가 폭발하지 않는다.

---

## 10. 신규 상품 등록 계획

### 1차 출시 상품

| 슬러그 | 이름 | 원작 | 배경 | 언어 | 레벨 |
|---|---|---|---|---|---|
| `story-deutsch-b1-cinderella` | 베를린의 신데렐라 | 신데렐라 | 현대 베를린 | 독일어 | B1 |

B1 단어 232세션을 모두 커버하지 않고, 1차는 20~30챕터로 파일럿 상품을 만든다. 사용자 반응 확인 후 챕터 수를 결정한다.

### 확장 계획

파일럿 상품 반응이 좋으면 다음 순서로 확장:
1. 같은 이야기 × 다른 레벨 (A2, A1)
2. 다른 이야기 × 같은 레벨 (B1 미스터리, B1 SF)
3. 다른 언어 (스페인어 × 전래동화)

---

## 11. 관리자 삽화 관리

### 개요

story 카드는 n8n 파이프라인으로 텍스트만 생성된다. 삽화는 관리자가 별도로 이미지 URL을 입력하여 추가한다. 삽화가 없어도 학습에 문제없으며, 추가되면 챕터 상단에 표시된다.

### 관리자 화면 진입점

기존 `/admin/products/:id/stages/:stageId` 스테이지 편집 화면에 story 타입 전용 삽화 입력 필드를 추가한다.

### 삽화 입력 UI

```
[스테이지 편집 화면 — story 타입일 때만 노출]

┌─────────────────────────────────────┐
│ 챕터 미리보기                        │
│ "초인종 소리에 엘라는 천천히..."      │
├─────────────────────────────────────┤
│ 삽화 이미지 URL                      │
│ [________________________] [저장]   │
│                                     │
│ 미리보기:                           │
│ (URL 입력 시 이미지 미리보기 표시)   │
└─────────────────────────────────────┘
```

### 저장 동작

관리자가 URL을 입력하고 저장하면:

```
POST /admin/api/cards/upsert
→ nv2_cards.card_data.illustration_url 업데이트
→ { ok: true }
```

기존 `cards.tsx` upsert API를 그대로 활용한다. card_data JSONB 필드를 부분 업데이트한다.

### 이미지 소스 전략

- 초기: 외부 이미지 URL 직접 입력 (Unsplash, DALL-E 생성 후 업로드 등)
- 추후: 관리자 화면에서 DALL-E API 호출로 자동 생성 버튼 추가 가능

---

## 12. 미결 사항

| 항목 | 내용 | 상태 |
|---|---|---|
| story 스테이지 완료 기준 | "다음 학습으로 →" 버튼 클릭 시 완료 처리 | ✅ 구현 완료 |
| 문장 진행 방식 | 클릭 → 다음 문장. 마커 문장은 단어 확인 후 자동 진행 | ✅ 구현 완료 |
| 마커 단어 TTS | 단어 클릭 즉시 TTS 자동 재생 1회 | ✅ 구현 완료 |
| DM hook_text 연동 | enqueue-daily에서 hook_text를 DM 메시지에 포함 | 🔜 미구현 |
| 챕터 재생성 기준 | 마커 누락 시 Generate Story 노드 수동 재실행 | 운영 중 |
| 삽화 관리 | 어드민 stage 편집 화면에서 illustration_url 직접 입력 | ✅ 구현 완료 |
| Story Learning 시즌 확장 | 시즌 2~12 (232세션 완성), 타 언어/이야기 추가 | 🔜 미구현 |

---

## 13. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-18 | Story Learning 기능 기획 확정 |
| 2026-04-18 | 미결 사항 확정: 완료 기준(모든 카드 확인 필수), 카드 스킵 없음 |
| 2026-04-18 | 삽화 관리 기능 추가: illustration_url 필드, 관리자 편집 화면 |
| 2026-04-20 | 세션 구성 변경: story 스테이지 첫 번째 → learning×5 이후로 변경 |
| 2026-04-20 | learning 스테이지: B1 원본 stage_id 공유 → 카드 데이터 복사본으로 독립 생성 |
| 2026-04-20 | story UX: 타이핑 엔진 → 문장 단위 reveal 방식으로 전면 교체 |
| 2026-04-20 | card_data 필드 추가: chapter_title, hook_text |
| 2026-04-20 | n8n 워크플로우: Snow White B1 S1 생성기 완성 및 20챕터 콘텐츠 생성 |
| 2026-04-20 | Leni 채팅 story 말풍선 추가 (새 탭 열기, ?next=close 완료 후 닫힘) |
| 2026-04-20 | session-page 챕터 요약 카드: hook_text + 학습 흐름 3단계 표시 |
| 2026-04-20 | story-deutsch-b1-snowwhite 시즌 1 (20챕터) 런칭 |
| 2026-05-02 | Leni 채팅 방식 전환: buildNewSessionPrompt(한국어 기반) → buildStorySessionPrompt(목표 언어 전용 대화) |
| 2026-05-02 | meta 필드 확인: story/season/setting 모두 세팅 완료 ({"story":"snowwhite","season":1,"setting":"modern Germany"}) |
| 2026-05-02 | Rule 7: 사용자 learnerLanguage 입력 → 입력 내용의 targetLanguage 번역 자동 제공, 언어 전환 요청만 방어 응답 |