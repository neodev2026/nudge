/**
 * /sentence/:stageId
 *
 * Sentence practice stage — word ordering + shadowing exercise.
 *
 * Flow per sentence card:
 *   Step 1 (Order)   : Words from the example sentence are shuffled into buttons.
 *                      User taps them in the correct order to reconstruct the sentence.
 *                      On wrong order → reset word bank (max 2 mistakes before answer shown).
 *                      On correct order OR 2 mistakes → move to Step 2.
 *   Step 2 (Shadow)  : Full sentence displayed. TTS plays automatically.
 *                      User can replay as many times as they want.
 *                      "다음" advances to the next sentence card.
 *
 * After all sentence cards are complete → POST result → redirect to session.
 *
 * TTS: reuses the same _tts_looping / stopTts pattern as stage-page.tsx.
 */
import type { Route } from "./+types/sentence-page";

import { useLoaderData, useFetcher, Link } from "react-router";
import { useState, useCallback, useEffect } from "react";
import { redirect } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import {
  getSentenceStageContext,
  getSentenceCardPool,
} from "../lib/queries.server";
import type { SentenceCard } from "../lib/queries.server";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = ({ matches }) => {
  const loader_data = matches.find(
    (m) => m?.id === "routes/sentence/:stageId"
  )?.data as Awaited<ReturnType<typeof loader>> | undefined;

  return [
    {
      title: loader_data
        ? `${loader_data.stage.title} — 문장 연습 — Nudge`
        : "Nudge",
    },
  ];
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);

  const session_id = new URL(request.url).searchParams.get("session");
  const from_chat = new URL(request.url).searchParams.get("from") === "chat";

  if (!session_id) {
    throw new Response("session parameter is required", { status: 400 });
  }

  // Resolve stage + session context
  const context = await getSentenceStageContext(
    client,
    params.stageId,
    session_id
  );

  if (!context) {
    throw new Response("Stage or session not found", { status: 404 });
  }

  const { stage, session } = context;

  // Resolve link_access + sns identity
  const { data: auth_session } = await client.auth.getSession();
  const auth_user = auth_session.session?.user ?? null;
  const is_authenticated = !!auth_user;

  let sns_type: string | null = session.sns_type;
  let sns_id: string | null = session.sns_id;
  let link_access: "public" | "members_only" = "public";

  const { getSessionIdentity } = await import(
    "~/features/v2/session/lib/queries.server"
  );
  const identity = await getSessionIdentity(client, session_id).catch(
    () => null
  );

  if (identity) {
    sns_type = identity.sns_type;
    sns_id = identity.sns_id;
    link_access = identity.link_access;

    if (identity.link_access === "members_only" && !is_authenticated) {
      const next = encodeURIComponent(
        `/sentence/${params.stageId}?session=${session_id}`
      );
      throw redirect(`/auth/discord/start?next=${next}`);
    }
  }

  // Collect sentence cards from this session's learning stages
  const sentence_cards = await getSentenceCardPool(
    client,
    session.product_session_id,
    params.stageId
  );

  return {
    stage,
    from_chat,
    sentence_cards,
    session_id,
    sns_type,
    sns_id,
    link_access,
    is_authenticated,
  };
}

// ---------------------------------------------------------------------------
// TTS — module-level flag (mirrors stage-page.tsx)
// ---------------------------------------------------------------------------

let _tts_looping = false;

function stopTts() {
  _tts_looping = false;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SentencePage() {
  const {
    stage,
    sentence_cards,
    session_id,
    sns_type,
    sns_id,
    from_chat,
  } = useLoaderData<typeof loader>();

  const [card_index, set_card_index] = useState(0);
  const [phase, set_phase] = useState<"order" | "shadow">("order");
  const [all_done, set_all_done] = useState(false);

  const result_fetcher = useFetcher();

  const can_submit = !!sns_type && !!sns_id;
  const current_card = sentence_cards[card_index];
  const total = sentence_cards.length;

  // When result is saved: close tab if from_chat, else redirect to session
  const result_data = result_fetcher.data as { ok?: boolean } | undefined;
  useEffect(() => {
    if (result_data?.ok) {
      if (from_chat) {
        window.close();
      } else if (session_id) {
        window.location.href = `/sessions/${session_id}`;
      }
    }
  }, [result_data, session_id, from_chat]);

  function handleOrderComplete() {
    // Move from word-ordering to shadowing
    set_phase("shadow");
  }

  function handleShadowNext() {
    stopTts();
    const next_index = card_index + 1;
    if (next_index < total) {
      set_card_index(next_index);
      set_phase("order");
    } else {
      // All cards done — submit result
      set_all_done(true);
      if (can_submit) {
        result_fetcher.submit(
          { sns_type, sns_id },
          {
            method: "POST",
            action: `/api/v2/sentence/${stage.id}/result`,
            encType: "application/json",
          }
        );
      }
    }
  }

  if (sentence_cards.length === 0) {
    return (
      <EmptyState
        stage_title={stage.title}
        session_id={session_id}
      />
    );
  }

  if (all_done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fdf8f0] px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-[0_8px_40px_rgba(26,39,68,0.10)]">
          <div className="mb-3 text-5xl">🎉</div>
          <h2 className="mb-2 font-display text-xl font-black text-[#1a2744]">
            문장 연습 완료!
          </h2>
          <p className="text-sm text-[#6b7a99]">세션 페이지로 돌아가는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#fdf8f0] px-4 py-10">
      {/* Header */}
      <div className="mb-8 w-full max-w-md">
        <Link
          to={session_id ? `/sessions/${session_id}` : "/products"}
          className="text-xs font-semibold text-[#6b7a99] hover:text-[#1a2744]"
          onClick={stopTts}
        >
          ← 학습 목록
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-lg bg-[#1a2744] px-3 py-1 text-[0.7rem] font-black uppercase tracking-wide text-white">
            문장 연습
          </span>
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {sentence_cards.map((_, i) => (
              <span
                key={i}
                className={[
                  "h-2 w-2 rounded-full transition-colors",
                  i < card_index
                    ? "bg-[#4caf72]"
                    : i === card_index
                    ? "bg-[#1a2744]"
                    : "bg-[#1a2744]/20",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6 w-full max-w-md">
        <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-widest text-[#6b7a99]">
          <span>{phase === "order" ? "STEP 1: 문장 만들기" : "STEP 2: 따라 말하기"}</span>
          <span>{card_index + 1} / {total}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8ecf5]">
          <div
            className="h-full rounded-full bg-[#1a2744] transition-all duration-500"
            style={{ width: `${((card_index + (phase === "shadow" ? 0.5 : 0)) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      {phase === "order" ? (
        <OrderStep
          card={current_card}
          on_complete={handleOrderComplete}
        />
      ) : (
        <ShadowStep
          card={current_card}
          on_next={handleShadowNext}
          is_last={card_index === total - 1}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrderStep — word bank ordering exercise
// ---------------------------------------------------------------------------

function OrderStep({
  card,
  on_complete,
}: {
  card: SentenceCard;
  on_complete: () => void;
}) {
  // Tokenise: multi-word → split by space, single-word → split by character
  const tokens = tokenizeExample(card.example_front);

  // Shuffle tokens for initial display
  const [shuffled] = useState<string[]>(() => shuffle([...tokens]));
  const [selected, set_selected] = useState<string[]>([]);
  const [available, set_available] = useState<boolean[]>(() =>
    shuffled.map(() => true)
  );
  const [mistake_count, set_mistake_count] = useState(0);
  const [show_answer, set_show_answer] = useState(false);
  const [flash_error, set_flash_error] = useState(false);

  const MAX_MISTAKES = 2;

  function handleWordTap(shuffled_index: number) {
    if (show_answer) return;
    if (!available[shuffled_index]) return;

    const word = shuffled[shuffled_index];
    const next_selected = [...selected, word];
    const next_available = available.map((v, i) =>
      i === shuffled_index ? false : v
    );

    set_selected(next_selected);
    set_available(next_available);

    // Check when all words placed
    if (next_selected.length === tokens.length) {
      if (arraysEqual(next_selected, tokens)) {
        // Correct!
        setTimeout(on_complete, 500);
      } else {
        // Wrong
        const new_mistakes = mistake_count + 1;
        set_mistake_count(new_mistakes);
        set_flash_error(true);
        setTimeout(() => set_flash_error(false), 600);

        if (new_mistakes >= MAX_MISTAKES) {
          // Show answer and let user proceed
          set_show_answer(true);
          set_selected(tokens);
        } else {
          // Reset
          setTimeout(() => {
            set_selected([]);
            set_available(shuffled.map(() => true));
          }, 700);
        }
      }
    }
  }

  function handleRemoveWord(index: number) {
    if (show_answer) return;
    const word = selected[index];
    // Find the first available slot in shuffled that matches this word
    const restore_idx = shuffled.findIndex(
      (w, i) => w === word && !available[i]
    );
    set_selected(selected.filter((_, i) => i !== index));
    if (restore_idx !== -1) {
      set_available(available.map((v, i) => (i === restore_idx ? true : v)));
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      {/* Hint card */}
      <div className="rounded-3xl bg-white p-6 shadow-[0_8px_40px_rgba(26,39,68,0.10)]">
        <span className="mb-2 inline-block rounded-lg bg-[#fdf8f0] px-3 py-1 text-[0.68rem] font-black uppercase tracking-wide text-[#6b7a99]">
          단어
        </span>
        <p className="font-display text-2xl font-black text-[#1a2744]">
          {card.word}
        </p>
        {card.description_back && (
          <p className="mt-2 text-sm leading-relaxed text-[#6b7a99]">
            {card.description_back}
          </p>
        )}
      </div>

      {/* Translation hint — shown above dropzone so user knows what to build */}
      {card.example_back && (
        <p className="text-center text-sm font-bold text-[#1a2744]">
          {card.example_back}
        </p>
      )}

      {/* Dropzone */}
      <div
        className={[
          "min-h-[68px] w-full rounded-2xl border-2 border-dashed p-4 transition-colors",
          flash_error
            ? "border-red-300 bg-red-50"
            : show_answer
            ? "border-[#4caf72] bg-[#4caf72]/5"
            : "border-[#c8d0e0] bg-white",
        ].join(" ")}
      >
        {selected.length === 0 ? (
          <p className="text-center text-sm text-[#6b7a99]">
            아래 단어를 순서대로 탭하세요
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selected.map((word, i) => (
              <button
                key={i}
                onClick={() => handleRemoveWord(i)}
                disabled={show_answer}
                className="rounded-xl bg-[#1a2744] px-3 py-1.5 text-sm font-bold text-white transition-all active:scale-95 disabled:cursor-default"
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mistake indicator */}
      {mistake_count > 0 && !show_answer && (
        <p className="text-center text-xs font-bold text-red-400">
          틀렸어요. {MAX_MISTAKES - mistake_count}번 더 틀리면 정답을 보여드려요.
        </p>
      )}

      {/* Word bank */}
      <div className="flex flex-wrap justify-center gap-2">
        {shuffled.map((word, i) => (
          <button
            key={i}
            onClick={() => handleWordTap(i)}
            disabled={!available[i] || show_answer}
            className={[
              "rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all active:scale-95",
              !available[i]
                ? "invisible"
                : "border-[#e8ecf5] bg-white text-[#1a2744] hover:border-[#1a2744]",
            ].join(" ")}
          >
            {word}
          </button>
        ))}
      </div>

      {/* Show-answer proceed button */}
      {show_answer && (
        <button
          onClick={on_complete}
          className="mt-2 w-full rounded-2xl bg-[#4caf72] py-4 text-base font-extrabold text-white transition-all hover:bg-[#5ecb87] active:scale-[0.98]"
        >
          정답 확인 후 다음 →
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShadowStep — TTS shadowing
// ---------------------------------------------------------------------------

function ShadowStep({
  card,
  on_next,
  is_last,
}: {
  card: SentenceCard;
  on_next: () => void;
  is_last: boolean;
}) {
  // Auto-play TTS on mount using card's resolved language
  useEffect(() => {
    playOnce(card.example_front, card.tts_lang);
    return () => stopTts();
  }, [card.example_front, card.tts_lang]);

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      {/* Sentence display */}
      <div className="rounded-3xl bg-[#1a2744] p-8 text-center shadow-[0_8px_40px_rgba(26,39,68,0.20)]">
        <span className="mb-4 inline-block text-[0.68rem] font-black uppercase tracking-widest text-blue-300">
          STEP 2: 따라 말하기
        </span>
        <p className="mb-2 text-2xl font-bold leading-snug text-white">
          {card.example_front}
        </p>
        <p className="text-sm text-blue-200">{card.example_back}</p>
      </div>

      {/* TTS button */}
      <TtsButton text={card.example_front} lang={card.tts_lang} />

      {/* Hint */}
      {card.description_back && (
        <div className="rounded-2xl bg-white px-5 py-4 text-sm leading-relaxed text-[#6b7a99] shadow-sm">
          <span className="mr-1 font-black text-[#1a2744]">{card.word}</span>
          {card.description_back}
        </div>
      )}

      {/* Next button */}
      <button
        onClick={on_next}
        className="mt-2 w-full rounded-2xl bg-[#1a2744] py-4 text-base font-extrabold text-white transition-all hover:bg-[#243358] active:scale-[0.98]"
      >
        {is_last ? "완료 ✓" : "다음 →"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TTS utilities
// ---------------------------------------------------------------------------

function playOnce(text: string, lang = "de-DE") {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  stopTts();
  _tts_looping = true;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang;
  utt.rate = 0.9;
  utt.onend = () => {
    _tts_looping = false;
  };
  utt.onerror = () => {
    _tts_looping = false;
  };
  window.speechSynthesis.speak(utt);
}

function useTts(text: string, lang = "de-DE") {
  const [active, set_active] = useState(false);

  const toggle = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (_tts_looping) {
      stopTts();
      set_active(false);
      return;
    }

    _tts_looping = true;
    set_active(true);

    const speak = () => {
      if (!_tts_looping) return;
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = lang;
      utt.rate = 0.9;
      utt.onend = () => {
        if (_tts_looping) setTimeout(speak, 700);
      };
      utt.onerror = () => {
        _tts_looping = false;
        set_active(false);
      };
      window.speechSynthesis.speak(utt);
    };
    speak();
  }, [text, lang]);

  return { toggle, active };
}

function TtsButton({ text, lang = "de-DE" }: { text: string; lang?: string }) {
  const { toggle, active } = useTts(text, lang);
  return (
    <button
      onClick={toggle}
      className={[
        "flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-extrabold transition-all active:scale-[0.98]",
        active
          ? "bg-[#4caf72] text-white"
          : "bg-white text-[#1a2744] shadow-sm hover:bg-[#e8ecf5]",
      ].join(" ")}
    >
      <span className="text-lg">{active ? "⏹" : "🔊"}</span>
      {active ? "중지" : "발음 듣기"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

function EmptyState({
  stage_title,
  session_id,
}: {
  stage_title: string;
  session_id: string | null;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 text-5xl">📭</span>
      <h2 className="mb-2 font-display text-xl font-black text-[#1a2744]">
        {stage_title}
      </h2>
      <p className="mb-6 text-sm text-[#6b7a99]">
        연습할 예문이 없어요. 앞선 학습 단계에 예문 카드가 있는지 확인해 주세요.
      </p>
      <Link
        to={session_id ? `/sessions/${session_id}` : "/products"}
        className="text-sm font-bold text-[#4caf72] hover:underline"
      >
        ← 학습 목록으로
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Tokenizes example_front for Step1.
 * - Multiple words (contains space): split by space → word-order exercise
 * - Single word (no space): split into individual characters → character-order exercise
 */
function tokenizeExample(text: string): string[] {
  const words = text.split(" ").filter(Boolean);
  if (words.length > 1) return words;
  return text.trim().split("");
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}
