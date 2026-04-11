/**
 * Leni chat service
 *
 * Handles OpenAI API calls for the Leni AI chat feature.
 *
 * Environment variable required:
 *   OPENAI_API_SECRET_NUDGE_LENI_CHAT — OpenAI API key
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeniChatMessage {
  role: "leni" | "user";
  text: string;
}

export interface LeniCardContext {
  stage_id: string;
  card_id: string;
  stage_title: string;
  word: string;
  meaning: string;
  description: string;
  example?: string;
  example_translation?: string;
  target_locale: string;
  learner_locale: string;
}

export interface LeniQuizStage {
  stage_id: string;
  stage_type: string;
  title: string;
  display_order: number;
}

export interface LeniBubble {
  type: "card" | "quiz";
  card_id?: string;
  stage_id?: string;
  cards?: unknown[];
  title?: string;  // quiz bubble display title
}

export interface LeniResponse {
  text: string;
  bubbles: LeniBubble[];
  complete_stages: boolean; // when true, message.tsx marks all learning stages complete
  session_complete: boolean;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(
  cards: LeniCardContext[],
  quiz_stages: LeniQuizStage[],
  display_name: string,
  session_title: string,
  product_category: string
): string {
  const target_locale = cards[0]?.target_locale ?? "unknown";
  const learner_locale = cards[0]?.learner_locale ?? "ko";
  const is_language = product_category === "language";

  const card_list = cards
    .map((c, i) => {
      const lines = [
        `[단어 ${i + 1}] word="${c.word}" meaning="${c.meaning}" card_id="${c.card_id}" stage_id="${c.stage_id}"`,
        `  설명: ${c.description}`,
      ];
      if (c.example) lines.push(`  예문: ${c.example}`);
      if (c.example_translation) lines.push(`  예문 번역: ${c.example_translation}`);
      return lines.join("\n");
    })
    .join("\n\n");

  const quiz_list = quiz_stages.length > 0
    ? quiz_stages
        .map((q) => `[퀴즈 ${q.display_order}] stage_id="${q.stage_id}" type="${q.stage_type}" title="${q.title}"`)
        .join("\n")
    : "없음";

  const all_card_ids = cards.map((c) => `{"type":"card","card_id":"${c.card_id}"}`).join(", ");
  const all_quiz_ids = quiz_stages.map((q) => `{"type":"quiz","stage_id":"${q.stage_id}","title":"${q.title}"}`).join(", ");

  const step7_rule = is_language
    ? `### 7단계: 실전 대화
- 세션 단어들을 활용하는 ${target_locale} 대화를 진행하세요.
- 학습 레벨에 맞는 어휘로 대화하세요 (오늘 단어 위주).
- 학습자가 어려워하면 "${learner_locale}와 ${target_locale}를 섞어" 대화하세요.
  예: "나는 ${cards[0]?.word ?? "단어"}이 좋아요!" 형식으로 쉽게 유도.
- 대화 중간중간 오늘 배운 단어를 자연스럽게 활용하세요.`
    : `### 7단계: 실전 연습
- 오늘 학습한 내용을 다양하게 활용하는 문답을 진행하세요.`;

  return `
당신은 Nudge 학습 서비스의 AI 튜터 Leni입니다.

## Leni 캐릭터
- 15세 독일 소녀, 밝고 긍정적, 애교 많음
- 본인도 Nudge로 공부 중인 사용자의 공부 친구
- 말투: 존댓말, 따뜻하고 밝게, 이모지 자연스럽게 사용
- 가끔 독일어 표현 자연스럽게 섞기 (Kein Problem!, Sehr gut!, Versprochen! 등)
- 대화 중간중간 오늘 학습 단어(target 언어)를 자연스럽게 섞어 사용

## 오늘 학습 세션 정보
세션명: ${session_title}
학습 언어: ${target_locale}
학습자 언어: ${learner_locale}
학습자 이름: ${display_name}
상품 카테고리: ${product_category}

## 오늘 학습 카드 목록
${card_list}

## 퀴즈 스테이지 목록 (quiz bubble에만 사용)
${quiz_list}

---

## 세션 진행 순서 (반드시 이 순서를 따르세요)

### 1단계: 학습 카드 전시 (대화 시작 첫 메시지)
모든 학습 카드를 bubbles에 담아 전시하세요.
bubbles 값: [${all_card_ids}]
텍스트: 세션 학습 목표를 간단히 소개하고 "위 내용을 모두 읽어보고, 기억나는 내용들을 저에게 이야기해주세요. 질문도 환영이에요!" 의미의 메시지를 Leni 캐릭터에 맞게 작성.
complete_stages: false

### 2단계: 사용자 응답 대기
- 학습 내용 관련 질문은 성실히 답변.
- 다른 이야기 시도 시: 부드럽게 "그 이야기는 나중에요! 먼저 카드 내용을 이야기해주세요 😊"
complete_stages: false

### 3단계: 사용자가 기억 내용 입력 시 (complete_stages: true)
사용자가 단어나 학습 내용을 이야기하면:
- 간단히 평가하고 빠진 내용을 보충 설명.
- complete_stages: true 로 설정 (모든 학습 카드 완료 처리).
- bubbles: []

### 4단계: 퀴즈 스테이지 전시 (3단계 직후 다음 응답)
모든 퀴즈 스테이지를 bubbles에 담아 전시하세요. 각 버블에 title 필드를 반드시 포함하세요.
bubbles 값: [${all_quiz_ids || "없음"}]
텍스트: "각각의 퀴즈를 순서대로 해보세요. 완료 후에는 저랑 실전 연습을 해봐요!" 의미를 Leni 캐릭터에 맞게 작성.
complete_stages: false
⚠️ 중요: quiz stage_id는 반드시 위 [퀴즈 스테이지 목록]의 값만 사용. 단어 목록의 stage_id 절대 사용 금지.

${step7_rule}

### 언어 대화 / 단어 활용 요청 처리 (단계 무관)
사용자가 언제든지 학습 언어로 대화하거나 단어를 활용한 연습을 요청하면,
현재 진행 단계와 관계없이 즉시 해당 언어로 대화를 시작하세요.
예: "독일어로 이야기해요", "영어로 대화해봐요", "오늘 단어 써봐요" 등

---

## 퀴즈 규칙 (절대 준수)
- 퀴즈는 반드시 bubbles 배열의 quiz 버블로만 제공.
- 텍스트로 직접 문제 출제 금지 (받아쓰기, 문장완성, O×X, 빈칸채우기 등 모든 형식).

## 오프-토픽 처리
학습과 무관한 대화는 부드럽게 거절하고 현재 단계로 유도.

## 세션 완료 판단
모든 단계 완료 + 실전 대화 충분히 진행 시 session_complete: true.

---

## 응답 형식 (엄격히 준수)
마크다운 코드블록 없이 JSON만 출력하세요.

기본:
{"text": "...", "bubbles": [], "complete_stages": false, "session_complete": false}

카드 버블 여러 개 (1단계):
{"text": "...", "bubbles": [{"type":"card","card_id":"<id1>"}, {"type":"card","card_id":"<id2>"}], "complete_stages": false, "session_complete": false}

퀴즈 버블 여러 개 (4단계, title 포함 필수):
{"text": "...", "bubbles": [{"type":"quiz","stage_id":"<qid1>","title":"<title1>"}, {"type":"quiz","stage_id":"<qid2>","title":"<title2>"}], "complete_stages": false, "session_complete": false}

3단계 학습 완료:
{"text": "...", "bubbles": [], "complete_stages": true, "session_complete": false}
`.trim();
}

// ---------------------------------------------------------------------------
// OpenAI API caller
// ---------------------------------------------------------------------------

async function callOpenAI(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): Promise<string> {
  const api_key = process.env.OPENAI_API_SECRET_NUDGE_LENI_CHAT;
  if (!api_key) throw new Error("OPENAI_API_SECRET_NUDGE_LENI_CHAT is not set");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${api_key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 800,
      temperature: 0.8,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error [${res.status}]: ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getLeniResponse(
  user_message: string,
  history: LeniChatMessage[],
  cards: LeniCardContext[],
  quiz_stages: LeniQuizStage[],
  display_name: string,
  session_title: string,
  product_category: string
): Promise<LeniResponse> {
  const system_prompt = buildSystemPrompt(
    cards,
    quiz_stages,
    display_name,
    session_title,
    product_category
  );

  const openai_messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [{ role: "system", content: system_prompt }];

  for (const msg of history) {
    openai_messages.push({
      role: msg.role === "leni" ? "assistant" : "user",
      content: msg.text,
    });
  }
  openai_messages.push({ role: "user", content: user_message });

  const raw = await callOpenAI(openai_messages);

  try {
    const parsed = JSON.parse(raw);
    const text = typeof parsed.text === "string" ? parsed.text : raw;
    const complete_stages = parsed.complete_stages === true;
    const session_complete = parsed.session_complete === true;

    const raw_bubbles = Array.isArray(parsed.bubbles) ? parsed.bubbles : [];
    const bubbles: LeniBubble[] = raw_bubbles
      .filter((b: unknown) => b && typeof b === "object")
      .map((b: Record<string, unknown>) => {
        if (b.type === "card" && typeof b.card_id === "string") {
          return { type: "card" as const, card_id: b.card_id };
        }
        if (b.type === "quiz" && typeof b.stage_id === "string") {
          return {
            type: "quiz" as const,
            stage_id: b.stage_id,
            title: typeof b.title === "string" ? b.title : undefined,
          };
        }
        return null;
      })
      .filter(Boolean) as LeniBubble[];

    return { text, bubbles, complete_stages, session_complete };
  } catch {
    console.warn("[leni] Failed to parse JSON response, using raw text");
    return { text: raw, bubbles: [], complete_stages: false, session_complete: false };
  }
}
