/**
 * /sessions/:sessionId/chat
 *
 * Leni AI chat page.
 *
 * Changes from feedback:
 *   - Profile image: /images/leni/leni-chat-profile.png (2x size)
 *   - Input autofocus on mount
 *   - Load previous conversation from DB on enter
 *   - Intro: no greeting — immediately show all cards + choices
 *   - Quiz bubble: window.open with ?from=chat, new tab
 */
import type { Route } from "./+types/chat-page";

import { useLoaderData, Link, useFetcher } from "react-router";
import { redirect } from "react-router";
import { useState, useRef, useEffect } from "react";

import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { getSessionIdentity } from "~/features/v2/session/lib/queries.server";
import { getNv2ProductSessionWithStages } from "~/features/v2/session/lib/queries.server";
import { getNv2StageWithCards } from "~/features/v2/stage/lib/queries.server";
import type { V2CardData } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MessageRole = "leni" | "user";
type BubbleType = "text" | "card" | "quiz";

interface CardObject {
  id: string;
  card_type: string;
  card_data: V2CardData;
  display_order: number;
}

interface ChatMessage {
  id: string;
  role: MessageRole;
  bubble_type: BubbleType;
  text: string;
  cards?: CardObject[];
  stage_id?: string;
  stage_type?: string;   // for quiz bubble URL routing
  stage_title?: string;  // for quiz bubble display
  session_id?: string;
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "Leni와 채팅 — Nudge" },
];

// ---------------------------------------------------------------------------
// Loader — also loads previous chat history and intro card data
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);

  const { data: auth_session } = await client.auth.getSession();
  const auth_user = auth_session.session?.user ?? null;

  if (!auth_user) {
    const next = encodeURIComponent(`/sessions/${params.sessionId}/chat`);
    throw redirect(`/auth/discord/start?next=${next}`);
  }

  const identity = await getSessionIdentity(client, params.sessionId);
  if (!identity) throw new Response("Session not found", { status: 404 });

  const product_session = await getNv2ProductSessionWithStages(
    client,
    identity.product_session_id
  );
  if (!product_session) throw new Response("Product session not found", { status: 404 });

  const session_title =
    product_session.title ?? `Session ${product_session.session_number}`;

  const display_name =
    (auth_user.user_metadata?.full_name as string | undefined) ??
    (auth_user.user_metadata?.global_name as string | undefined) ??
    "학습자";

  // ── Load previous conversation history ────────────────────────────────────
  const { data: history_rows } = await adminClient
    .from("nv2_chat_turns")
    .select("id, role, message_type, content, created_at")
    .eq("session_id", params.sessionId)
    .eq("auth_user_id", auth_user.id)
    .order("created_at", { ascending: true })
    .limit(60);

  // ── Load all learning stage cards for intro ───────────────────────────────
  const stages = product_session.nv2_product_session_stages ?? [];
  const learning_stages = stages.filter(
    (s) => (s.nv2_stages as any)?.stage_type === "learning"
  );

  // intro_cards: one entry per learning stage (all cards for that stage)
  const intro_cards: Array<{ stage_id: string; cards: CardObject[] }> = [];
  for (const s of learning_stages) {
    const stage = await getNv2StageWithCards(client, s.stage_id).catch(() => null);
    if (!stage || !stage.nv2_cards?.length) continue;
    intro_cards.push({
      stage_id: s.stage_id,
      cards: (stage.nv2_cards as unknown as CardObject[]).sort(
        (a, b) => a.display_order - b.display_order
      ),
    });
  }

  // quiz stage id for QuizBubble
  // Find first quiz stage — supports all quiz types (quiz_5, quiz_current_session, etc.)
  const QUIZ_STAGE_TYPES = [
    "quiz_current_session",
    "quiz_5",
    "quiz_10",
    "quiz_current_and_prev_session",
  ];
  const quiz_stage = stages.find(
    (s) => QUIZ_STAGE_TYPES.includes((s.nv2_stages as any)?.stage_type)
  );
  const quiz_stage_id = (quiz_stage?.stage_id as string | undefined) ?? null;

  return {
    session_id: params.sessionId,
    session_title,
    session_number: product_session.session_number,
    display_name,
    history_rows: history_rows ?? [],
    intro_cards,
    quiz_stage_id,
  };
}

// ---------------------------------------------------------------------------
// TTS helper
// ---------------------------------------------------------------------------

const TTS_LANG_MAP: Record<string, string> = {
  de: "de-DE", en: "en-US", ja: "ja-JP",
  ko: "ko-KR", fr: "fr-FR", es: "es-ES",
};

function speakOnce(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang;
  utt.rate = 0.9;
  window.speechSynthesis.speak(utt);
}

// ---------------------------------------------------------------------------
// Build initial messages from loader data
// ---------------------------------------------------------------------------

function buildIntroMessages(
  intro_cards: Array<{ stage_id: string; cards: CardObject[] }>,
  session_id: string,
  quiz_stage_id: string | null
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  const word_count = intro_cards.length;
  messages.push({
    id: "leni-intro-text",
    role: "leni",
    bubble_type: "text",
    text: `오늘 세션에서 ${word_count}개 단어를 학습해요! 아래 카드들을 먼저 살펴보고, 어떻게 진행할지 골라주세요 😊`,
  });

  intro_cards.forEach((entry, i) => {
    messages.push({
      id: `intro-card-${i}`,
      role: "leni",
      bubble_type: "card",
      text: "",
      cards: entry.cards,
      session_id,
    });
  });

  const choices = quiz_stage_id
    ? "위 카드를 한 번씩 읽어보세요! 준비가 되면 퀴즈로 연습하거나, 오늘 있었던 일을 이야기하면서 단어를 써봐요 😊"
    : "위 카드를 한 번씩 읽어보세요! 준비가 되면 오늘 있었던 일을 이야기하면서 단어를 써보거나, 예문 연습을 해봐요 😊";

  messages.push({
    id: "leni-choices",
    role: "leni",
    bubble_type: "text",
    text: choices,
  });

  return messages;
}

function buildInitialMessages(
  history_rows: Array<{ id: string; role: string; message_type: string; content: string }>,
  intro_cards: Array<{ stage_id: string; cards: CardObject[] }>,
  session_id: string,
  quiz_stage_id: string | null
): ChatMessage[] {
  // Always show intro cards at the top (cards + guidance message)
  const intro = buildIntroMessages(intro_cards, session_id, quiz_stage_id);

  // If there is existing history, append it below the intro
  if (history_rows.length > 0) {
    const restored: ChatMessage[] = [];

    for (const row of history_rows) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(row.content);
      } catch {
        parsed = { text: row.content };
      }

      const text = typeof parsed.text === "string" ? parsed.text : "";
      const type = parsed.type as string | undefined;

      // ── card/quiz bubbles from new format (bubbles array) ─────────────────
      const bubbles_arr = Array.isArray(parsed.bubbles) ? parsed.bubbles : [];
      if (bubbles_arr.length > 0) {
        // Text message first
        if (text.trim()) {
          restored.push({
            id: `${row.id}-text`,
            role: row.role as MessageRole,
            bubble_type: "text",
            text,
            session_id,
          });
        }
        // Then each bubble in order
        bubbles_arr.forEach((bubble: Record<string, unknown>, i: number) => {
          if (bubble.type === "card" && Array.isArray(bubble.cards) && bubble.cards.length > 0) {
            restored.push({
              id: `${row.id}-card-${i}`,
              role: "leni",
              bubble_type: "card",
              text: "",
              cards: bubble.cards as CardObject[],
              session_id,
            });
          } else if (bubble.type === "quiz" && typeof bubble.stage_id === "string") {
            restored.push({
              id: `${row.id}-quiz-${i}`,
              role: "leni",
              bubble_type: "quiz",
              text: "",
              stage_id: bubble.stage_id,
              stage_type: typeof bubble.stage_type === "string" ? bubble.stage_type : undefined,
              stage_title: typeof bubble.title === "string" ? bubble.title : undefined,
              session_id,
            });
          }
        });
        continue;
      }

      // ── legacy card bubble (old format without bubbles array) ─────────────
      if (row.message_type === "card" && type === "card" && Array.isArray(parsed.cards) && parsed.cards.length > 0) {
        if (text.trim()) {
          restored.push({ id: `${row.id}-text`, role: row.role as MessageRole, bubble_type: "text", text, session_id });
        }
        restored.push({ id: `${row.id}-card`, role: "leni", bubble_type: "card", text: "", cards: parsed.cards as CardObject[], session_id });
        continue;
      }

      // ── legacy quiz bubble ────────────────────────────────────────────────
      if (row.message_type === "quiz" && type === "quiz" && typeof parsed.stage_id === "string") {
        if (text.trim()) {
          restored.push({ id: `${row.id}-text`, role: row.role as MessageRole, bubble_type: "text", text, session_id });
        }
        restored.push({ id: `${row.id}-quiz`, role: "leni", bubble_type: "quiz", text: "", stage_id: parsed.stage_id, session_id });
        continue;
      }

      // ── plain text ────────────────────────────────────────────────────────
      if (!text.trim()) continue;
      restored.push({
        id: row.id,
        role: row.role as MessageRole,
        bubble_type: "text",
        text,
        session_id,
      });
    }

    if (restored.length > 0) {
      // intro + history + separator
      return [
        ...intro,
        ...restored,
        {
          id: "history-end",
          role: "leni",
          bubble_type: "text",
          text: "이전 대화를 불러왔어요! 이어서 진행해봐요 😊",
          session_id,
        },
      ];
    }

    // History exists but all rows were empty — just show intro
    return intro;
  }

  // No history — intro only
  return intro;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatPage() {
  const {
    session_id,
    session_title,
    session_number,
    display_name,
    history_rows,
    intro_cards,
    quiz_stage_id,
  } = useLoaderData<typeof loader>();

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    buildInitialMessages(history_rows, intro_cards, session_id, quiz_stage_id)
  );
  const [input, setInput] = useState("");
  const [is_typing, set_is_typing] = useState(false);
  const [is_session_complete, set_is_session_complete] = useState(false);
  const [remaining_turns, set_remaining_turns] = useState<number | null>(null);
  const [out_of_turns, set_out_of_turns] = useState(false);

  const bottom_ref = useRef<HTMLDivElement>(null);
  const input_ref = useRef<HTMLTextAreaElement>(null);
  const complete_fetcher = useFetcher<{ ok?: boolean }>();

  // Autofocus input on mount
  useEffect(() => {
    input_ref.current?.focus();
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    bottom_ref.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, is_typing]);

  // Session complete → call complete API
  useEffect(() => {
    if (
      is_session_complete &&
      complete_fetcher.state === "idle" &&
      !complete_fetcher.data
    ) {
      complete_fetcher.submit(
        {},
        { method: "POST", action: `/api/v2/sessions/${session_id}/complete` }
      );
    }
  }, [is_session_complete]);

  async function handleSend() {
    const text = input.trim();
    if (!text || is_typing || is_session_complete) return;

    const user_msg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      bubble_type: "text",
      text,
    };
    setMessages((prev) => [...prev, user_msg]);
    setInput("");
    set_is_typing(true);

    try {
      const res = await fetch(`/api/v2/chat/${session_id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      // Turn exhausted — show payment prompt
      if (data.out_of_turns) {
        setMessages((prev) => [
          ...prev,
          {
            id: `leni-no-turns-${Date.now()}`,
            role: "leni",
            bubble_type: "text",
            text: data.text,
          },
        ]);
        set_out_of_turns(true);
        return;
      }

      if (!res.ok || !data.ok) throw new Error(data.error ?? "Unknown error");

      // Update remaining turns display
      if (typeof data.remaining_turns === "number") {
        set_remaining_turns(data.remaining_turns);
      }

      // Leni text message
      const new_messages: ChatMessage[] = [
        {
          id: `leni-${Date.now()}`,
          role: "leni",
          bubble_type: "text",
          text: data.text,
        },
      ];

      // Append bubbles in order (card or quiz)
      const bubbles: Array<{
        type: "card" | "quiz";
        card_id?: string;
        stage_id?: string;
        cards?: unknown[];
      }> = Array.isArray(data.bubbles) ? data.bubbles : [];

      bubbles.forEach((bubble, i) => {
        if (bubble.type === "card" && Array.isArray(bubble.cards) && bubble.cards.length) {
          new_messages.push({
            id: `card-${Date.now()}-${i}`,
            role: "leni",
            bubble_type: "card",
            text: "",
            cards: bubble.cards as CardObject[],
          });
        } else if (bubble.type === "quiz" && bubble.stage_id) {
          new_messages.push({
            id: `quiz-${Date.now()}-${i}`,
            role: "leni",
            bubble_type: "quiz",
            text: "",
            stage_id: bubble.stage_id,
            stage_type: (bubble as any).stage_type,
            stage_title: (bubble as any).title,
            session_id,
          });
        }
      });

      setMessages((prev) => [...prev, ...new_messages]);

      // Focus input after Leni responds so user can type immediately
      setTimeout(() => input_ref.current?.focus(), 50);

      if (data.complete_stages) {
        // Learning stages were marked complete by Leni — nothing extra needed on client
        console.info("[chat] Learning stages marked complete by Leni");
      }
      if (data.session_complete) set_is_session_complete(true);
    } catch (err) {
      console.error("[chat] message failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "leni",
          bubble_type: "text",
          text: "앗, 잠깐 문제가 생겼어요 😢 잠시 후 다시 시도해주세요!",
        },
      ]);
    } finally {
      set_is_typing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#fdf8f0]">
      {/* ── Header ── */}
      <header className="shrink-0 border-b border-[#1a2744]/[0.07] bg-white/80 backdrop-blur-sm">
        {/* Top bar */}
        <div className="px-4 py-3">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            {/* Back button */}
            <button
              onClick={() => window.history.back()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#6b7a99] transition hover:bg-[#f0f2f8] hover:text-[#1a2744]"
              aria-label="뒤로"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Leni avatar — 2x size */}
            <div className="relative h-16 w-16 shrink-0">
              <img
                src="/images/leni/leni-chat-profile.png"
                alt="Leni"
                className="h-full w-full rounded-full object-cover shadow-sm"
              />
              <span className={["absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-white",
                is_typing ? "bg-[#f5a623]" : "bg-[#4caf72]"].join(" ")} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-black text-[#1a2744] truncate">Leni</p>
              <p className="text-xs text-[#6b7a99] truncate">
                {is_typing ? "입력 중..." : `Session ${session_number} · ${session_title}`}
              </p>
            </div>
          </div>
        </div>

        {/* Tab menu */}
        <div className="mx-auto flex max-w-lg border-t border-[#1a2744]/[0.06]">
          {/* 학습 목록 tab */}
          <Link
            to={`/sessions/${session_id}/list`}
            className="flex flex-1 items-center justify-center gap-1.5 border-b-2 border-transparent px-4 py-3 transition hover:border-[#1a2744]/30 hover:bg-[#f7f8fc]"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#6b7a99]">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-bold text-[#6b7a99]">학습 목록</span>
          </Link>
          {/* Leni와 학습 tab — active */}
          <div className="flex flex-1 items-center justify-center gap-1.5 border-b-2 border-[#c0589a] px-4 py-3">
            <img src="/images/leni/leni-chat-profile.png" alt="Leni"
              className="h-4 w-4 rounded-full object-cover" />
            <span className="text-xs font-extrabold text-[#c0589a]">Leni와 학습</span>
          </div>
        </div>
      </header>

      {/* ── Message list ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
          {messages.map((msg) => {
            if (msg.bubble_type === "card" && msg.cards?.length) {
              return <CardBubble key={msg.id} cards={msg.cards} />;
            }
            if (msg.bubble_type === "quiz" && msg.stage_id) {
              return (
                <QuizBubble
                  key={msg.id}
                  stage_id={msg.stage_id}
                  stage_type={msg.stage_type}
                  session_id={msg.session_id ?? session_id}
                  title={msg.stage_title}
                />
              );
            }
            return <MessageBubble key={msg.id} message={msg} />;
          })}

          {is_typing && <TypingIndicator />}

          {is_session_complete && (
            <div className="rounded-2xl bg-[#4caf72]/10 border border-[#4caf72]/20 px-5 py-4 text-center">
              <p className="text-sm font-bold text-[#4caf72]">🎉 오늘 학습 완료!</p>
              <Link
                to={`/sessions/${session_id}`}
                className="mt-2 inline-block text-xs font-bold text-[#1a2744] underline underline-offset-2"
              >
                세션 목록에서 확인하기 →
              </Link>
            </div>
          )}

          <div ref={bottom_ref} />
        </div>
      </main>

      {/* ── Input bar ── */}
      <footer className="shrink-0 border-t border-[#1a2744]/[0.07] bg-white/80 px-4 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-end gap-2">
          <textarea
            ref={input_ref}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              out_of_turns
                ? "대화 횟수를 모두 사용했어요 😢"
                : is_session_complete
                ? "오늘 학습이 완료됐어요 🎉"
                : "메시지를 입력하세요… (Enter로 전송)"
            }
            rows={1}
            disabled={is_typing || is_session_complete || out_of_turns}
            className="flex-1 resize-none rounded-2xl border border-[#1a2744]/10 bg-[#f7f8fc] px-4 py-3 text-sm text-[#1a2744] placeholder:text-[#b0b8cc] focus:border-[#4caf72] focus:outline-none focus:ring-2 focus:ring-[#4caf72]/20 transition disabled:opacity-50"
            style={{ maxHeight: "120px", overflowY: "auto" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || is_typing || is_session_complete || out_of_turns}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#4caf72] text-white shadow-[0_4px_12px_rgba(76,175,114,0.30)] transition-all hover:-translate-y-px hover:bg-[#5ecb87] disabled:translate-y-0 disabled:bg-[#c8e6d4] disabled:shadow-none"
            aria-label="전송"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
        {/* Turn info row */}
        <div className="mx-auto mt-2 flex max-w-lg items-center justify-between">
          <p className="text-[10px] text-[#b0b8cc]">
            Shift+Enter로 줄바꿈 · 학습과 관련된 대화만 가능해요
          </p>
          {remaining_turns !== null && !out_of_turns && (
            <p className="text-[10px] text-[#b0b8cc]">
              💬 {remaining_turns}턴 남음
            </p>
          )}
          {out_of_turns && (
            <a
              href="/pricing"
              className="rounded-lg bg-[#4caf72] px-3 py-1 text-[10px] font-bold text-white"
            >
              충전하기 →
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble — plain text
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: ChatMessage }) {
  const is_leni = message.role === "leni";
  return (
    <div className={["flex items-end gap-2", is_leni ? "justify-start" : "justify-end"].join(" ")}>
      {is_leni && (
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
          <img src="/images/leni/leni-chat-profile.png" alt="Leni" className="h-full w-full object-cover" />
        </div>
      )}
      <div className={[
        "max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
        is_leni
          ? "rounded-bl-sm bg-white text-[#1a2744] shadow-[0_2px_12px_rgba(26,39,68,0.08)]"
          : "rounded-br-sm bg-[#1a2744] text-white",
      ].join(" ")}>
        {message.text}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CardBubble — mini card viewer
// ---------------------------------------------------------------------------

const CARD_TYPE_LABELS: Record<string, string> = {
  title: "단어", description: "설명", image: "이미지",
  etymology: "어원", example: "예문",
};

function CardBubble({ cards }: { cards: CardObject[] }) {
  const [index, setIndex] = useState(0);
  const card = cards[index];
  if (!card) return null;

  const data = card.card_data as unknown as V2CardData;
  const type = card.card_type;
  const tts_lang = TTS_LANG_MAP[data.meta?.target_locale ?? "de"] ?? "de-DE";

  return (
    <div className="flex items-end gap-2 justify-start">
      <div className="h-8 w-8 shrink-0" />
      <div className="w-full max-w-[85%] overflow-hidden rounded-2xl rounded-bl-sm bg-white shadow-[0_2px_12px_rgba(26,39,68,0.10)]">
        {/* Badge + navigation */}
        <div className="flex items-center justify-between border-b border-[#f0f2f8] px-4 py-2">
          <span className="text-[0.65rem] font-black uppercase tracking-wider text-[#6b7a99]">
            {CARD_TYPE_LABELS[type] ?? type}
          </span>
          {cards.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}
                className="flex h-5 w-5 items-center justify-center rounded text-[#6b7a99] hover:text-[#1a2744] disabled:opacity-30">‹</button>
              <span className="text-[0.65rem] text-[#6b7a99]">{index + 1}/{cards.length}</span>
              <button onClick={() => setIndex((i) => Math.min(cards.length - 1, i + 1))} disabled={index === cards.length - 1}
                className="flex h-5 w-5 items-center justify-center rounded text-[#6b7a99] hover:text-[#1a2744] disabled:opacity-30">›</button>
            </div>
          )}
        </div>

        {/* Card content */}
        <div className="px-4 py-4">
          {type === "title" && (
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-display text-2xl font-black text-[#1a2744]">{data.presentation.front}</p>
                <p className="mt-0.5 text-base font-bold text-[#4caf72]">{data.presentation.back}</p>
              </div>
              <button onClick={() => speakOnce(data.presentation.front, tts_lang)}
                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fdf8f0] text-[#6b7a99] transition hover:bg-[#4caf72]/10 hover:text-[#4caf72]"
                aria-label="발음 듣기">🔊</button>
            </div>
          )}
          {type === "description" && (
            <p className="text-sm leading-[1.8] text-[#1a2744]">{data.presentation.back}</p>
          )}
          {type === "example" && (
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold leading-[1.8] text-[#1a2744]">{data.presentation.front}</p>
                <p className="mt-1 text-xs text-[#6b7a99]">{data.presentation.back}</p>
              </div>
              <button onClick={() => speakOnce(data.presentation.front, tts_lang)}
                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fdf8f0] text-[#6b7a99] transition hover:bg-[#4caf72]/10 hover:text-[#4caf72]"
                aria-label="발음 듣기">🔊</button>
            </div>
          )}
          {type === "etymology" && (
            <div>
              <p className="text-sm leading-[1.8] text-[#1a2744]">{data.presentation.front}</p>
              {data.presentation.back && <p className="mt-1 text-xs text-[#6b7a99]">{data.presentation.back}</p>}
            </div>
          )}
          {type === "image" && (
            <div className="overflow-hidden rounded-xl">
              <img src={data.presentation.front} alt={data.presentation.back} className="w-full object-cover" />
              {data.presentation.back && <p className="mt-1 text-xs text-[#6b7a99]">{data.presentation.back}</p>}
            </div>
          )}
          {data.details?.explanation && (
            <p className="mt-3 text-xs leading-[1.7] text-[#6b7a99]">{data.details.explanation}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuizBubble — opens in new tab with ?from=chat
// ---------------------------------------------------------------------------

// Stage types that use their own dedicated page (not /quiz/)
const DEDICATED_STAGE_ROUTES: Record<string, string> = {
  sentence_practice: "sentence",
  dictation: "dictation",
  writing: "writing",
};

function QuizBubble({
  stage_id,
  stage_type,
  session_id,
  title,
}: {
  stage_id: string;
  stage_type?: string;
  session_id: string;
  title?: string;
}) {
  function openQuiz() {
    // Route to the correct page based on stage_type
    const route = (stage_type && DEDICATED_STAGE_ROUTES[stage_type])
      ? DEDICATED_STAGE_ROUTES[stage_type]
      : "quiz";
    window.open(
      `/${route}/${stage_id}?session=${session_id}&from=chat`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="flex items-end gap-2 justify-start">
      <div className="h-8 w-8 shrink-0" />
      <div className="w-full max-w-[85%] rounded-2xl rounded-bl-sm border-2 border-dashed border-[#5865F2]/30 bg-[#5865F2]/5 px-4 py-4">
        <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-[#5865F2]">퀴즈</p>
        <p className="mb-3 text-sm font-bold text-[#1a2744]">
          {title ?? "지금까지 배운 단어를 확인해봐요!"}
        </p>
        <button
          onClick={openQuiz}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#5865F2] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#4752c4]"
        >
          퀴즈 시작 →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TypingIndicator
// ---------------------------------------------------------------------------

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 justify-start">
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
        <img src="/images/leni/leni-chat-profile.png" alt="Leni" className="h-full w-full object-cover" />
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-[0_2px_12px_rgba(26,39,68,0.08)]">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#b0b8cc]"
              style={{ animation: "leni-bounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
      <style>{`
        @keyframes leni-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
