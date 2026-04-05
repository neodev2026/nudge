/**
 * /quiz/:stageId?session=:sessionId
 *
 * Shared quiz page for quiz_5 and quiz_10.
 * Loader is shared; game UI is split by stage_type:
 *   quiz_5  → Quiz5Game  (placeholder — to be replaced with new design)
 *   quiz_10 → Quiz10Game (independent deck architecture)
 *
 * Quiz10Game spec:
 *   - Pool: 10 title cards (2 sessions worth)
 *   - word_pool / meaning_pool: independent circular decks, shuffled differently
 *   - VISIBLE_PAIRS: 4 (more cards visible with larger pool)
 *   - On match: only matched position replaced in-place from its own deck
 *   - Scoring: word+meaning=10pts, audio+meaning=30pts
 *   - Audio unlock: all 10 stage_ids matched ≥3 times → audio mode (50/50 mix)
 *   - Timer: 90s. On expire → result screen (no auto-redirect)
 *   - Result: score + ranking. Buttons: 재도전 / 학습 목록으로
 */
import type { Route } from "./+types/quiz-page";

import { useLoaderData, useFetcher } from "react-router";
import { useEffect, useRef, useState, useCallback } from "react";

import makeServerClient from "~/core/lib/supa-client.server";
import {
  getQuizStageContext,
  getQuizCardPool,
  getQuiz5CardPool,
} from "../lib/queries.server";
import type { Quiz5Card } from "../lib/queries.server";
import { getSessionIdentity } from "~/features/v2/session/lib/queries.server";
import { QUIZ_TIMER_SECONDS } from "~/features/v2/shared/constants";
import type { QuizCard, QuizRankEntry } from "../lib/queries.server";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [{ title: "퀴즈 — Nudge" }];

// ---------------------------------------------------------------------------
// Loader (shared)
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);

  const session_id = new URL(request.url).searchParams.get("session");
  if (!session_id) throw new Response("session param required", { status: 400 });

  const identity = await getSessionIdentity(client, session_id).catch(() => null);
  if (!identity) throw new Response("Session not found", { status: 404 });

  const ctx = await getQuizStageContext(client, params.stageId, session_id);
  if (!ctx) throw new Response("Quiz stage not found", { status: 404 });

  const { stage } = ctx;

  const card_pool = await getQuizCardPool(
    client,
    identity.product_session_id,
    params.stageId,
    stage.stage_type
  );

  const timer_seconds = QUIZ_TIMER_SECONDS[stage.stage_type] ?? 90;
  const covered_stage_ids = card_pool.map((c) => c.stage_id);

  // quiz_5 / quiz_current_session: collect title + description + example cards
  const quiz5_cards =
    (stage.stage_type === "quiz_5" || stage.stage_type === "quiz_current_session")
      ? await getQuiz5CardPool(
          client,
          identity.product_session_id,
          params.stageId,
          stage.stage_type
        )
      : [];

  return {
    stage_id: params.stageId,
    stage_type: stage.stage_type,
    stage_title: stage.title,
    session_id,
    sns_type: identity.sns_type,
    sns_id: identity.sns_id,
    card_pool,
    quiz5_cards,
    timer_seconds,
    covered_stage_ids,
  };
}

// ---------------------------------------------------------------------------
// Root component — stage_type 분기
// ---------------------------------------------------------------------------

export default function QuizPage() {
  const data = useLoaderData<typeof loader>();

  if (
    data.stage_type === "quiz_10" ||
    data.stage_type === "quiz_current_and_prev_session"
  ) {
    return <Quiz10Game {...data} />;
  }

  // quiz_5
  return (
    <Quiz5Game
      stage_id={data.stage_id}
      stage_type={data.stage_type}
      stage_title={data.stage_title}
      session_id={data.session_id}
      sns_type={data.sns_type}
      sns_id={data.sns_id}
      cards={data.quiz5_cards}
    />
  );
}

// ---------------------------------------------------------------------------
// Quiz5Game — 3-step quiz for quiz_5 stage
// ---------------------------------------------------------------------------

type Quiz5Step = "step1" | "step2" | "step3";

function Quiz5Game({
  stage_id,
  stage_type,
  stage_title,
  session_id,
  sns_type,
  sns_id,
  cards,
}: {
  stage_id: string;
  stage_type: string;
  stage_title: string;
  session_id: string;
  sns_type: string;
  sns_id: string;
  cards: Quiz5Card[];
}) {
  const result_fetcher = useFetcher();
  const [step, set_step] = useState<Quiz5Step>("step1");

  function handleComplete() {
    // Use the quiz result API which handles initNv2StageProgress + completeNv2Stage.
    // Pass minimal required fields; matched_pairs_count/score default to 0 for quiz_5.
    result_fetcher.submit(
      {
        sns_type,
        sns_id,
        stage_type,  // quiz_5 or quiz_current_session
        matched_pairs_count: 0,
        score: 0,
        covered_stage_ids: "",
        duration_seconds: 0,
      },
      {
        method: "POST",
        action: `/api/v2/quiz/${stage_id}/result`,
        encType: "application/json",
      }
    );
  }

  const result_data = result_fetcher.data as { ok?: boolean } | undefined;
  useEffect(() => {
    if (result_data?.ok) {
      window.location.href = `/sessions/${session_id}`;
    }
  }, [result_data]);

  if (cards.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fdf8f0] px-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-[0_8px_40px_rgba(26,39,68,0.10)]">
          <p className="mb-4 text-sm text-[#6b7a99]">퀴즈 카드가 없습니다.</p>
          <a href={`/sessions/${session_id}`}
            className="inline-block rounded-2xl bg-[#1a2744] px-6 py-3 text-sm font-extrabold text-white">
            학습 목록으로 →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fdf8f0]">
      {/* Header */}
      <div className="border-b border-[#e8ecf5] bg-white px-6 py-4">
        <div className="mx-auto max-w-md">
          <p className="text-xs font-bold uppercase tracking-wider text-[#4caf72]">퀴즈</p>
          <h1 className="font-display text-lg font-black text-[#1a2744]">{stage_title}</h1>
          {/* Step indicator */}
          <div className="mt-3 flex gap-2">
            {(["step1", "step2", "step3"] as Quiz5Step[]).map((s, i) => (
              <div key={s} className={[
                "h-1.5 flex-1 rounded-full transition-all",
                step === s ? "bg-[#1a2744]" :
                (step === "step2" && i === 0) || (step === "step3" && i < 2)
                  ? "bg-[#4caf72]" : "bg-[#e8ecf5]",
              ].join(" ")} />
            ))}
          </div>
          <p className="mt-1 text-[0.68rem] font-bold text-[#6b7a99]">
            {step === "step1" ? "STEP 1: 플래시카드" :
             step === "step2" ? "STEP 2: O/X 퀴즈" : "STEP 3: 문장 완성"}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-md">
          {step === "step1" && (
            <Quiz5Step1
              cards={cards}
              onComplete={() => set_step("step2")}
            />
          )}
          {step === "step2" && (
            <Quiz5Step2
              cards={cards}
              onComplete={() => set_step("step3")}
            />
          )}
          {step === "step3" && (
            <Quiz5Step3
              cards={cards}
              onComplete={handleComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiz5Step1 — Flash cards (front: word, back: translation + description)
// ---------------------------------------------------------------------------

function Quiz5Step1({
  cards,
  onComplete,
}: {
  cards: Quiz5Card[];
  onComplete: () => void;
}) {
  const [idx, set_idx] = useState(0);
  const [flipped, set_flipped] = useState(false);
  const card = cards[idx];
  const is_last = idx === cards.length - 1;

  function handleFlip() {
    if (!flipped) {
      playTts(card.word, card.tts_lang);
    }
    set_flipped((v) => !v);
  }

  function handleNext() {
    if (is_last) {
      onComplete();
    } else {
      set_idx((v) => v + 1);
      set_flipped(false);
    }
  }

  function handlePrev() {
    if (idx > 0) {
      set_idx((v) => v - 1);
      set_flipped(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm text-[#6b7a99]">카드를 터치하여 뒷면을 확인하세요!</p>

      {/* Flash card */}
      <div
        className="relative w-72 h-88 cursor-pointer"
        style={{ perspective: "1000px", height: "22rem" }}
        onClick={handleFlip}
      >
        <div
          className="relative w-full h-full transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 rounded-3xl bg-white shadow-[0_8px_40px_rgba(26,39,68,0.12)] flex flex-col items-center justify-center p-6"
            style={{ backfaceVisibility: "hidden" }}
          >
            <p className="font-display text-5xl font-black text-[#1a2744] mb-4 text-center">
              {card.word}
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); playTts(card.word, card.tts_lang); }}
              className="mt-2 flex items-center gap-2 rounded-xl bg-[#fdf8f0] px-4 py-2 text-sm font-bold text-[#6b7a99] hover:bg-[#e8ecf5]"
            >
              🔊 발음 듣기
            </button>
          </div>
          {/* Back */}
          <div
            className="absolute inset-0 rounded-3xl bg-[#1a2744] text-white shadow-[0_8px_40px_rgba(26,39,68,0.20)] flex flex-col items-center justify-center p-6 text-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <p className="font-display text-3xl font-black mb-3">{card.translation}</p>
            <p className="text-sm leading-relaxed text-white/70">{card.description}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex w-full items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={idx === 0}
          className="rounded-2xl border-2 border-[#e8ecf5] bg-white px-5 py-3 text-sm font-bold text-[#6b7a99] disabled:opacity-30"
        >
          이전
        </button>
        <span className="text-sm font-bold text-[#6b7a99]">{idx + 1} / {cards.length}</span>
        <button
          onClick={handleNext}
          className={[
            "rounded-2xl px-5 py-3 text-sm font-extrabold text-white transition-all",
            is_last ? "bg-[#4caf72]" : "bg-[#1a2744]",
          ].join(" ")}
        >
          {is_last ? "퀴즈 시작! →" : "다음"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quiz5Step2 — O/X Quiz (word + translation pair check)
// ---------------------------------------------------------------------------

interface OXQuestion {
  word: string;
  shown_translation: string;
  is_correct: boolean;
  correct_translation: string;
}

function Quiz5Step2({
  cards,
  onComplete,
}: {
  cards: Quiz5Card[];
  onComplete: () => void;
}) {
  const [lives, set_lives] = useState(3);
  const [queue, set_queue] = useState<OXQuestion[]>(() => buildOXQueue(cards));
  const [current, set_current] = useState<OXQuestion | null>(() =>
    queue.length > 0 ? queue[0] : null
  );
  const [remaining, set_remaining] = useState<OXQuestion[]>(() => queue.slice(1));
  const [feedback, set_feedback] = useState<"correct" | "wrong" | null>(null);
  const [wrong_info, set_wrong_info] = useState<string>("");
  const [animating, set_animating] = useState(false);

  function loadNext(q: OXQuestion[], l: number) {
    if (q.length === 0) {
      onComplete();
      return;
    }
    set_current(q[0]);
    set_remaining(q.slice(1));
    set_feedback(null);
    set_animating(false);
  }

  function handleAnswer(user_yes: boolean) {
    if (!current || animating) return;
    set_animating(true);

    const correct = user_yes === current.is_correct;
    set_feedback(correct ? "correct" : "wrong");

    if (!correct) {
      const new_lives = lives - 1;
      set_lives(new_lives);
      set_wrong_info(current.correct_translation);

      if (new_lives <= 0) {
        // Reset
        setTimeout(() => {
          const new_queue = buildOXQueue(cards);
          set_lives(3);
          set_queue(new_queue);
          set_current(new_queue[0]);
          set_remaining(new_queue.slice(1));
          set_feedback(null);
          set_animating(false);
        }, 1800);
        return;
      }
    }

    setTimeout(() => loadNext(remaining, lives), correct ? 800 : 1800);
  }

  if (!current) return null;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Lives */}
      <div className="flex items-center gap-1">
        {[...Array(3)].map((_, i) => (
          <span key={i} className={i < lives ? "text-2xl" : "text-2xl opacity-20"}>❤️</span>
        ))}
        <span className="ml-2 text-sm font-bold text-[#6b7a99]">
          {remaining.length + 1}문제 남음
        </span>
      </div>

      {/* Question card */}
      <div className={[
        "w-full rounded-3xl p-8 text-center shadow-[0_8px_40px_rgba(26,39,68,0.10)] transition-all duration-300",
        feedback === "correct" ? "bg-[#4caf72] text-white" :
        feedback === "wrong"   ? "bg-red-500 text-white" : "bg-white",
      ].join(" ")}>
        <p className="font-display text-4xl font-black mb-4 text-inherit" style={{color: feedback ? "white" : "#1a2744"}}>
          {current.word}
        </p>
        <div className={[
          "inline-block rounded-2xl px-6 py-2",
          feedback === "correct" ? "bg-white/20" :
          feedback === "wrong"   ? "bg-white/20" : "bg-[#fdf8f0]",
        ].join(" ")}>
          <p className="text-xl font-bold" style={{color: feedback ? "white" : "#1a2744"}}>
            {current.shown_translation}
          </p>
        </div>
        {feedback === "wrong" && (
          <p className="mt-4 text-sm text-white/80">
            정답: <span className="font-bold text-white">{wrong_info}</span>
          </p>
        )}
        {feedback === "correct" && <p className="mt-4 text-2xl">✓</p>}
        {!feedback && lives === 0 && (
          <p className="mt-4 text-sm text-red-500 font-bold">처음부터 다시!</p>
        )}
      </div>

      {/* O/X Buttons */}
      <div className="flex gap-8 justify-center">
        <button
          onClick={() => handleAnswer(false)}
          disabled={!!feedback}
          className="w-20 h-20 rounded-full border-4 border-red-400 bg-white text-red-400 text-4xl font-black shadow-lg active:scale-90 transition-all disabled:opacity-40"
        >
          X
        </button>
        <button
          onClick={() => handleAnswer(true)}
          disabled={!!feedback}
          className="w-20 h-20 rounded-full border-4 border-[#4caf72] bg-white text-[#4caf72] text-4xl font-black shadow-lg active:scale-90 transition-all disabled:opacity-40"
        >
          O
        </button>
      </div>
    </div>
  );
}

function buildOXQueue(cards: Quiz5Card[]): OXQuestion[] {
  const q: OXQuestion[] = [];
  cards.forEach((card) => {
    // Correct pair
    q.push({
      word: card.word,
      shown_translation: card.translation,
      is_correct: true,
      correct_translation: card.translation,
    });
    // Wrong pair — pick another card's translation
    const others = cards.filter((c) => c.stage_id !== card.stage_id);
    const wrong = others[Math.floor(Math.random() * others.length)];
    q.push({
      word: card.word,
      shown_translation: wrong?.translation ?? card.translation,
      is_correct: false,
      correct_translation: card.translation,
    });
  });
  // Shuffle
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [q[i], q[j]] = [q[j], q[i]];
  }
  return q;
}

// ---------------------------------------------------------------------------
// Quiz5Step3 — Sentence word ordering
// ---------------------------------------------------------------------------

function Quiz5Step3({
  cards,
  onComplete,
}: {
  cards: Quiz5Card[];
  onComplete: () => void;
}) {
  const [idx, set_idx] = useState(0);
  const [mistake_count, set_mistake_count] = useState(0);
  const [show_answer, set_show_answer] = useState(false);
  const [selected, set_selected] = useState<string[]>([]);
  const [available, set_available] = useState<boolean[]>([]);
  const [flash_error, set_flash_error] = useState(false);

  const card = cards[idx];
  const tokens = tokenizeExample(card.example_front);

  // shuffled is managed as state so it can be updated when idx changes
  const [shuffled, set_shuffled] = useState<string[]>(() => quiz5Shuffle([...tokens]));

  useEffect(() => {
    resetCard(tokenizeExample(cards[idx].example_front));
  }, [idx]);

  function resetCard(current_tokens: string[]) {
    set_shuffled(quiz5Shuffle([...current_tokens]));
    set_selected([]);
    set_mistake_count(0);
    set_show_answer(false);
    set_flash_error(false);
    set_available(new Array(current_tokens.length).fill(true));
  }

  function handleWordTap(token_idx: number) {
    if (show_answer) return;
    if (!available[token_idx]) return;

    const word = shuffled[token_idx];
    const next_selected = [...selected, word];
    const next_available = available.map((v, i) => i === token_idx ? false : v);

    set_selected(next_selected);
    set_available(next_available);

    if (next_selected.length === tokens.length) {
      const sep = tokens.length > 1 && tokens[0].length > 1 ? " " : "";
      if (next_selected.join(sep) === tokens.join(sep)) {
        // Correct
        playTts(card.example_front, card.tts_lang);
        setTimeout(handleNext, 900);
      } else {
        // Wrong
        const new_mistakes = mistake_count + 1;
        set_mistake_count(new_mistakes);
        set_flash_error(true);
        setTimeout(() => set_flash_error(false), 600);

        if (new_mistakes >= 2) {
          set_show_answer(true);
          set_selected([...tokens]);
          set_available(new Array(tokens.length).fill(false));
        } else {
          setTimeout(() => {
            set_selected([]);
            set_available(new Array(tokens.length).fill(true));
          }, 700);
        }
      }
    }
  }

  function handleRemoveTap(pos: number) {
    if (show_answer) return;
    const word = selected[pos];
    // Find first unavailable slot in shuffled matching this word
    const restore = shuffled.findIndex((w, i) => w === word && !available[i]);
    set_selected(selected.filter((_, i) => i !== pos));
    if (restore !== -1) {
      set_available(available.map((v, i) => i === restore ? true : v));
    }
  }

  function handleNext() {
    if (idx < cards.length - 1) {
      set_idx((v) => v + 1);
    } else {
      onComplete();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="flex justify-between text-xs font-bold text-[#6b7a99]">
        <span>{idx + 1} / {cards.length}</span>
        {mistake_count > 0 && !show_answer && (
          <span className="text-red-400">
            {2 - mistake_count}번 더 틀리면 정답 공개
          </span>
        )}
      </div>

      {/* Hint card */}
      <div className="rounded-3xl bg-white p-6 shadow-[0_8px_40px_rgba(26,39,68,0.10)]">
        <span className="mb-2 inline-block rounded-lg bg-[#fdf8f0] px-3 py-1 text-[0.68rem] font-black uppercase tracking-wide text-[#6b7a99]">
          단어
        </span>
        <p className="font-display text-2xl font-black text-[#1a2744]">{card.word}</p>
        <p className="mt-2 text-sm text-[#6b7a99]">{card.example_back}</p>
      </div>

      {/* Drop zone */}
      <div className={[
        "min-h-[64px] w-full rounded-2xl border-2 border-dashed p-4 transition-colors",
        flash_error   ? "border-red-300 bg-red-50" :
        show_answer   ? "border-[#4caf72] bg-[#4caf72]/5" :
                        "border-[#c8d0e0] bg-white",
      ].join(" ")}>
        {selected.length === 0 ? (
          <p className="text-center text-sm text-[#6b7a99]">
            아래 단어를 순서대로 탭하세요
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selected.map((word, i) => (
              <button
                key={i}
                onClick={() => handleRemoveTap(i)}
                disabled={show_answer}
                className="rounded-xl bg-[#1a2744] px-3 py-1.5 text-sm font-bold text-white transition-all active:scale-95 disabled:cursor-default"
              >
                {word}
              </button>
            ))}
          </div>
        )}
      </div>

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

      {/* Show answer proceed */}
      {show_answer && (
        <button
          onClick={handleNext}
          className="w-full rounded-2xl bg-[#4caf72] py-4 text-base font-extrabold text-white transition-all active:scale-[0.98]"
        >
          {idx < cards.length - 1 ? "다음 →" : "완료 ✓"}
        </button>
      )}
    </div>
  );
}

/**
 * Tokenizes example_front for Step3.
 * - Multiple words (contains space): split by space → word-order exercise
 * - Single word (no space): split into individual characters → character-order exercise
 */
function tokenizeExample(text: string): string[] {
  const words = text.split(" ").filter(Boolean);
  if (words.length > 1) return words;
  // Single word — split into characters
  return text.trim().split("");
}

function quiz5Shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Types (Quiz10Game)
// ---------------------------------------------------------------------------

type WordMode = "word" | "audio";

interface WordSlot {
  mode: WordMode;
  card: QuizCard;
}

interface MeaningSlot {
  card: QuizCard;
}

// ---------------------------------------------------------------------------
// Constants (Quiz10Game)
// ---------------------------------------------------------------------------

/** quiz_10 shows 4 pairs at once — larger pool supports it without collision */
const Q10_VISIBLE_PAIRS = 4;

/** Minimum number of correct pairs guaranteed visible at any time */
const MIN_PAIRS_GUARANTEED = 3;
const AUDIO_UNLOCK_THRESHOLD = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Simple one-shot TTS utility for Quiz5 steps
function playTts(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang;
  utt.rate = 0.9;
  window.speechSynthesis.speak(utt);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildInitialWordSlots(pool: QuizCard[], count: number): WordSlot[] {
  return pool.slice(0, count).map((c) => ({ mode: "word" as WordMode, card: c }));
}

/**
 * Builds initial meaning slots ensuring at least MIN_PAIRS_GUARANTEED
 * of them share a logic_key with a word slot card.
 * Remaining slots are filled with non-matching cards for variety.
 */
function buildInitialMeaningSlots(
  meaning_pool: QuizCard[],
  word_cards: QuizCard[],
  count: number
): MeaningSlot[] {
  const word_keys = new Set(word_cards.map((c) => c.logic_key));
  const matching   = meaning_pool.filter((c) => word_keys.has(c.logic_key));
  const non_matching = meaning_pool.filter((c) => !word_keys.has(c.logic_key));

  const selected: QuizCard[] = [];
  // Pick up to MIN_PAIRS_GUARANTEED matching cards
  for (const c of matching) {
    if (selected.length >= MIN_PAIRS_GUARANTEED) break;
    if (!selected.find((s) => s.card_id === c.card_id)) selected.push(c);
  }
  // Fill remaining slots with non-matching cards
  for (const c of non_matching) {
    if (selected.length >= count) break;
    if (!selected.find((s) => s.card_id === c.card_id)) selected.push(c);
  }
  // If still not enough, fill with any remaining matching cards
  for (const c of matching) {
    if (selected.length >= count) break;
    if (!selected.find((s) => s.card_id === c.card_id)) selected.push(c);
  }

  return shuffleArray(selected).map((c) => ({ card: c }));
}

function maskId(id: string): string {
  if (id.length <= 4) return id;
  return id.slice(0, 3) + "***";
}

// ---------------------------------------------------------------------------
// Quiz10Game
// ---------------------------------------------------------------------------

function Quiz10Game({
  stage_id,
  stage_type,
  stage_title,
  session_id,
  sns_type,
  sns_id,
  card_pool,
  timer_seconds,
  covered_stage_ids,
}: {
  stage_id: string;
  stage_type: string;
  stage_title: string;
  session_id: string;
  sns_type: string;
  sns_id: string;
  card_pool: QuizCard[];
  timer_seconds: number;
  covered_stage_ids: string[];
}) {
  const result_fetcher = useFetcher();
  const vp = Math.min(Q10_VISIBLE_PAIRS, card_pool.length);

  // ── Initial slot data (computed before refs so visible sets can be seeded) ─
  // word_pool and meaning_pool are plain arrays — computed here before useRef.
  const _word_pool_init    = card_pool;
  const _meaning_pool_init = shuffleArray(card_pool);

  const _initial_word_slots = buildInitialWordSlots(_word_pool_init, vp);
  // meaning slots are built with matching-pair guarantee, selecting cards that
  // may differ from the first vp entries of meaning_pool — so visible set must
  // be seeded from the actual returned slots, not pool order.
  const _initial_meaning_slots = buildInitialMeaningSlots(
    _meaning_pool_init,
    _initial_word_slots.map((s) => s.card),
    vp
  );

  // ── Independent decks ─────────────────────────────────────────────────────
  const word_pool    = useRef<QuizCard[]>(_word_pool_init);
  const meaning_pool = useRef<QuizCard[]>(_meaning_pool_init);

  // Circular pointers — start after initially visible cards
  const word_ptr    = useRef(vp % card_pool.length);
  const meaning_ptr = useRef(vp % card_pool.length);

  // card_ids currently visible in each column
  const word_visible = useRef<Set<string>>(
    new Set(_initial_word_slots.map((s) => s.card.card_id))
  );
  // Seeded from actual meaning slots (not pool order) to stay consistent.
  const meaning_visible = useRef<Set<string>>(
    new Set(_initial_meaning_slots.map((s) => s.card.card_id))
  );

  // ── Slots ─────────────────────────────────────────────────────────────────
  const [word_slots, set_word_slots] = useState<WordSlot[]>(() => _initial_word_slots);

  // Ref mirror of word_slots for synchronous reads inside advanceMeaningDeck
  const word_slots_ref = useRef<WordSlot[]>(_initial_word_slots);

  const [meaning_slots, set_meaning_slots] = useState<MeaningSlot[]>(
    () => _initial_meaning_slots
  );

  // ── Game state ────────────────────────────────────────────────────────────
  const [time_left, set_time_left]               = useState(timer_seconds);
  const [score, set_score]                       = useState(0);
  const [matched_count, set_matched_count]       = useState(0);
  const [is_done, set_is_done]                   = useState(false);
  const [duration_elapsed, set_duration_elapsed] = useState(0);

  const [selected_word,    set_selected_word]    = useState<QuizCard | null>(null);
  const [selected_meaning, set_selected_meaning] = useState<QuizCard | null>(null);
  const [shake_id, set_shake_id]                 = useState<string | null>(null);

  // Per-stage match counter — ref avoids stale closure
  const match_count      = useRef<Record<string, number>>(
    Object.fromEntries(card_pool.map((c) => [c.stage_id, 0]))
  );
  const [audio_unlocked, set_audio_unlocked] = useState(false);
  const audio_unlocked_ref                   = useRef(false);

  // ── Timer ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (is_done) return;
    if (time_left <= 0) {
      finishGame(score, matched_count, duration_elapsed);
      return;
    }
    const t = setTimeout(() => {
      set_time_left((v) => v - 1);
      set_duration_elapsed((v) => v + 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [time_left, is_done]);

  // ── Submit ────────────────────────────────────────────────────────────────

  const submitResult = useCallback(
    (final_score: number, final_pairs: number, elapsed: number) => {
      result_fetcher.submit(
        {
          sns_type,
          sns_id,
          stage_type,
          matched_pairs_count: final_pairs,
          score: final_score,
          covered_stage_ids: covered_stage_ids.join(","),
          duration_seconds: elapsed,
        },
        {
          method: "POST",
          action: `/api/v2/quiz/${stage_id}/result`,
          encType: "application/json",
        }
      );
    },
    [sns_type, sns_id, stage_type, covered_stage_ids, stage_id]
  );

  function finishGame(
    final_score: number,
    final_pairs: number,
    elapsed: number
  ) {
    set_is_done(true);
    submitResult(final_score, final_pairs, elapsed);
  }

  // ── Match logic ───────────────────────────────────────────────────────────

  function handleWordClick(card: QuizCard) {
    if (is_done) return;
    if (selected_word?.card_id === card.card_id) {
      set_selected_word(null);
      return;
    }
    set_selected_word(card);
    if (selected_meaning) tryMatch(card, selected_meaning);
  }

  function handleMeaningClick(card: QuizCard) {
    if (is_done) return;
    if (selected_meaning?.card_id === card.card_id) {
      set_selected_meaning(null);
      return;
    }
    set_selected_meaning(card);
    if (selected_word) tryMatch(selected_word, card);
  }

  function tryMatch(w: QuizCard, m: QuizCard) {
    set_selected_word(null);
    set_selected_meaning(null);

    if (w.logic_key !== m.logic_key) {
      set_shake_id(m.card_id);
      setTimeout(() => set_shake_id(null), 500);
      return;
    }

    // Correct match
    const slot = word_slots.find((s) => s.card.card_id === w.card_id);
    const pts  = slot?.mode === "audio" ? 30 : 10;
    set_score((v) => v + pts);
    set_matched_count((v) => v + 1);

    // Per-stage counter
    match_count.current[w.stage_id] =
      (match_count.current[w.stage_id] ?? 0) + 1;

    // Audio unlock
    if (!audio_unlocked_ref.current) {
      const all_hit = Object.values(match_count.current).every(
        (v) => v >= AUDIO_UNLOCK_THRESHOLD
      );
      if (all_hit) {
        audio_unlocked_ref.current = true;
        set_audio_unlocked(true);
      }
    }

    // advanceWordDeck returns the updated word slots synchronously
    // so advanceMeaningDeck can read the correct word keys immediately.
    const updated_word_slots = advanceWordDeck(w.card_id, audio_unlocked_ref.current);
    advanceMeaningDeck(m.card_id, updated_word_slots);
  }

  // ── Deck advance ──────────────────────────────────────────────────────────

  // Returns updated word slots synchronously so advanceMeaningDeck
  // can compute the correct word_keys before its own state update.
  function advanceWordDeck(matched_id: string, use_audio: boolean): WordSlot[] {
    word_visible.current.delete(matched_id);

    let next: QuizCard | null = null;
    const len = word_pool.current.length;
    for (let i = 0; i < len; i++) {
      const idx = (word_ptr.current + i) % len;
      const c   = word_pool.current[idx];
      if (!word_visible.current.has(c.card_id)) {
        next = c;
        word_ptr.current = (idx + 1) % len;
        word_visible.current.add(c.card_id);
        break;
      }
    }

    if (!next) return word_slots_ref.current;
    const mode: WordMode =
      use_audio && Math.random() < 0.5 ? "audio" : "word";

    // Compute updated slots synchronously and update ref immediately
    const current = word_slots_ref.current;
    const pos = current.findIndex((s) => s.card.card_id === matched_id);
    if (pos === -1) return current;
    const updated = [...current];
    updated[pos] = { mode, card: next };
    word_slots_ref.current = updated; // sync ref before advanceMeaningDeck runs

    set_word_slots(updated);
    return updated;
  }

  function advanceMeaningDeck(matched_id: string, updated_word_slots: WordSlot[]) {
    meaning_visible.current.delete(matched_id);

    // Use the synchronously-updated word slots passed from advanceWordDeck
    // to get the correct word keys for pair-count calculation.
    const current_word_keys = new Set(
      updated_word_slots.map((s) => s.card.logic_key)
    );
    const remaining_meaning_keys = new Set(
      [...meaning_visible.current].map((card_id) => {
        const c = meaning_pool.current.find((x) => x.card_id === card_id);
        return c?.logic_key ?? "";
      })
    );
    const current_pairs = [...current_word_keys].filter(
      (k) => remaining_meaning_keys.has(k)
    ).length;
    const need_matching = current_pairs < MIN_PAIRS_GUARANTEED;

    const len = meaning_pool.current.length;
    let next: QuizCard | null = null;

    if (need_matching) {
      // Priority: find a card whose logic_key matches a current word slot
      for (let i = 0; i < len; i++) {
        const idx = (meaning_ptr.current + i) % len;
        const c   = meaning_pool.current[idx];
        if (
          !meaning_visible.current.has(c.card_id) &&
          current_word_keys.has(c.logic_key)
        ) {
          next = c;
          meaning_ptr.current = (idx + 1) % len;
          meaning_visible.current.add(c.card_id);
          break;
        }
      }
    }

    // Fallback: pick the next available card in circular order
    if (!next) {
      for (let i = 0; i < len; i++) {
        const idx = (meaning_ptr.current + i) % len;
        const c   = meaning_pool.current[idx];
        if (!meaning_visible.current.has(c.card_id)) {
          next = c;
          meaning_ptr.current = (idx + 1) % len;
          meaning_visible.current.add(c.card_id);
          break;
        }
      }
    }

    if (!next) return;

    set_meaning_slots((prev) => {
      const pos = prev.findIndex((s) => s.card.card_id === matched_id);
      if (pos === -1) return prev;
      const updated = [...prev];
      updated[pos] = { card: next! };
      return updated;
    });
  }

  // ── Restart ───────────────────────────────────────────────────────────────

  function handleRestart() {
    const wp = shuffleArray(card_pool);
    const mp = shuffleArray(card_pool);

    // Compute new slots first — visible sets must be seeded from actual slots
    const new_word_slots = buildInitialWordSlots(wp, vp);
    const new_meaning_slots = buildInitialMeaningSlots(
      mp, new_word_slots.map((s) => s.card), vp
    );

    word_pool.current    = wp;
    meaning_pool.current = mp;
    word_ptr.current     = vp % card_pool.length;
    meaning_ptr.current  = vp % card_pool.length;
    word_visible.current    = new Set(new_word_slots.map((s) => s.card.card_id));
    meaning_visible.current = new Set(new_meaning_slots.map((s) => s.card.card_id));
    match_count.current     = Object.fromEntries(card_pool.map((c) => [c.stage_id, 0]));
    audio_unlocked_ref.current = false;
    word_slots_ref.current  = new_word_slots;

    set_time_left(timer_seconds);
    set_score(0);
    set_matched_count(0);
    set_is_done(false);
    set_duration_elapsed(0);
    set_selected_word(null);
    set_selected_meaning(null);
    set_shake_id(null);
    set_audio_unlocked(false);
    set_word_slots(new_word_slots);
    set_meaning_slots(new_meaning_slots);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const timer_pct   = (time_left / timer_seconds) * 100;
  const timer_color =
    timer_pct > 50 ? "#4caf72" : timer_pct > 25 ? "#f59e0b" : "#ef4444";

  const result_data = result_fetcher.data as
    | { ok: boolean; ranking: QuizRankEntry[] }
    | undefined;
  const ranking = result_data?.ranking ?? [];

  if (card_pool.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fdf8f0]">
        <div className="px-6 text-center">
          <p className="text-lg font-bold text-[#1a2744]">퀴즈 카드가 없습니다</p>
          <p className="mt-2 text-sm text-[#6b7a99]">
            이 세션에 학습 카드가 없어 퀴즈를 진행할 수 없습니다.
          </p>
          <a
            href={`/sessions/${session_id}`}
            className="mt-6 inline-block rounded-xl bg-[#1a2744] px-6 py-3 text-sm font-extrabold text-white"
          >
            세션으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fdf8f0]">
      {/* Header */}
      <div className="border-b border-[#e8ecf5] bg-white px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#4caf72]">퀴즈</p>
              <h1 className="font-display text-lg font-black text-[#1a2744]">{stage_title}</h1>
            </div>
            {!is_done && (
              <div className="flex flex-col items-center">
                <span
                  className="font-display text-3xl font-black tabular-nums"
                  style={{ color: timer_color }}
                >
                  {time_left}
                </span>
                <span className="text-xs text-[#6b7a99]">초</span>
              </div>
            )}
          </div>

          {!is_done && (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8ecf5]">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${timer_pct}%`, backgroundColor: timer_color }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <div>
                  {audio_unlocked && (
                    <span className="rounded-full bg-[#f59e0b]/10 px-2 py-0.5 text-[0.68rem] font-black text-[#f59e0b]">
                      발음 모드 해금!
                    </span>
                  )}
                </div>
                <div className="font-bold text-[#6b7a99]">
                  점수:{" "}
                  <span className="text-lg font-black text-[#1a2744]">{score}</span>
                  <span className="ml-1 text-xs">점</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl">
          {is_done ? (
            <ResultView
              score={score}
              matched_pairs={matched_count}
              ranking={ranking}
              sns_id={sns_id}
              session_id={session_id}
              is_submitting={result_fetcher.state !== "idle"}
              onRestart={handleRestart}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Word column */}
              <div className="space-y-3">
                <p className="text-center text-xs font-bold uppercase tracking-wider text-[#6b7a99]">
                  단어
                </p>
                {word_slots.map((slot) =>
                  slot.mode === "audio" ? (
                    <AudioSlotButton
                      key={slot.card.card_id}
                      card={slot.card}
                      is_selected={selected_word?.card_id === slot.card.card_id}
                      is_shaking={shake_id === slot.card.card_id}
                      onClick={() => handleWordClick(slot.card)}
                    />
                  ) : (
                    <WordButton
                      key={slot.card.card_id}
                      text={slot.card.front}
                      is_selected={selected_word?.card_id === slot.card.card_id}
                      is_shaking={shake_id === slot.card.card_id}
                      onClick={() => handleWordClick(slot.card)}
                    />
                  )
                )}
              </div>

              {/* Meaning column */}
              <div className="space-y-3">
                <p className="text-center text-xs font-bold uppercase tracking-wider text-[#6b7a99]">
                  의미
                </p>
                {meaning_slots.map((slot) => (
                  <MeaningButton
                    key={slot.card.card_id}
                    text={slot.card.back}
                    is_selected={selected_meaning?.card_id === slot.card.card_id}
                    is_shaking={shake_id === slot.card.card_id}
                    onClick={() => handleMeaningClick(slot.card)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WordButton
// ---------------------------------------------------------------------------

function WordButton({
  text, is_selected, is_shaking, onClick,
}: {
  text: string; is_selected: boolean; is_shaking: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full rounded-2xl border-2 px-3 py-4 text-sm font-bold transition-all active:scale-[0.97]",
        is_selected
          ? "border-[#1a2744] bg-[#1a2744] text-white shadow-[0_4px_16px_rgba(26,39,68,0.25)]"
          : "border-[#e8ecf5] bg-white text-[#1a2744] hover:border-[#4caf72] hover:shadow-sm",
        is_shaking ? "animate-[shake_0.4s_ease-in-out]" : "",
      ].join(" ")}
    >
      {text}
    </button>
  );
}

// ---------------------------------------------------------------------------
// AudioSlotButton
// ---------------------------------------------------------------------------

function AudioSlotButton({
  card, is_selected, is_shaking, onClick,
}: {
  card: QuizCard; is_selected: boolean; is_shaking: boolean; onClick: () => void;
}) {
  const [playing, set_playing] = useState(false);

  function handleClick() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      set_playing(true);
      const utt = new SpeechSynthesisUtterance(card.front);
      utt.lang = card.tts_lang;
      utt.rate = 0.9;
      utt.onend  = () => set_playing(false);
      utt.onerror = () => set_playing(false);
      window.speechSynthesis.speak(utt);
    }
    onClick();
  }

  return (
    <button
      onClick={handleClick}
      className={[
        "w-full rounded-2xl border-2 px-3 py-4 text-sm font-bold transition-all active:scale-[0.97]",
        is_selected
          ? "border-[#1a2744] bg-[#1a2744] text-white shadow-[0_4px_16px_rgba(26,39,68,0.25)]"
          : "border-[#e8ecf5] bg-white text-[#1a2744] hover:border-[#4caf72] hover:shadow-sm",
        is_shaking ? "animate-[shake_0.4s_ease-in-out]" : "",
      ].join(" ")}
    >
      <span className="flex items-center justify-center gap-2">
        <span className={["text-xl", playing ? "animate-pulse" : ""].join(" ")}>
          🔊
        </span>
        <span className={is_selected ? "text-white/70" : "text-[#6b7a99]"}>
          {playing ? "재생 중..." : "터치하여 듣기"}
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// MeaningButton
// ---------------------------------------------------------------------------

function MeaningButton({
  text, is_selected, is_shaking, onClick,
}: {
  text: string; is_selected: boolean; is_shaking: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "w-full rounded-2xl border-2 px-3 py-4 text-sm font-bold transition-all active:scale-[0.97]",
        is_selected
          ? "border-[#1a2744] bg-[#1a2744] text-white shadow-[0_4px_16px_rgba(26,39,68,0.25)]"
          : "border-[#e8ecf5] bg-white text-[#1a2744] hover:border-[#4caf72] hover:shadow-sm",
        is_shaking ? "animate-[shake_0.4s_ease-in-out]" : "",
      ].join(" ")}
    >
      {text}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ResultView
// ---------------------------------------------------------------------------

function ResultView({
  score, matched_pairs, ranking, sns_id, session_id, is_submitting, onRestart,
}: {
  score: number; matched_pairs: number; ranking: QuizRankEntry[];
  sns_id: string; session_id: string; is_submitting: boolean; onRestart: () => void;
}) {
  const my_rank_idx = ranking.findIndex((r) => r.sns_id === sns_id);
  const my_rank     = my_rank_idx >= 0 ? my_rank_idx + 1 : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl bg-white p-8 text-center shadow-[0_8px_40px_rgba(26,39,68,0.10)]">
        <div className="mb-2 text-5xl">🎉</div>
        <h2 className="mb-1 font-display text-2xl font-black text-[#1a2744]">퀴즈 완료!</h2>
        <div className="mt-4">
          <span className="font-display text-5xl font-black text-[#4caf72]">{score}</span>
          <span className="ml-1 text-lg font-bold text-[#6b7a99]">점</span>
        </div>
        <p className="mt-1 text-sm text-[#6b7a99]">
          {matched_pairs}쌍 매칭
          {my_rank && (
            <span className="ml-2 font-bold text-[#f59e0b]">· {my_rank}위</span>
          )}
        </p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-[0_8px_40px_rgba(26,39,68,0.10)]">
        <h3 className="mb-4 text-sm font-black uppercase tracking-wider text-[#6b7a99]">
          이 스테이지 랭킹
        </h3>
        {is_submitting ? (
          <p className="text-center text-sm text-[#6b7a99]">집계 중...</p>
        ) : ranking.length === 0 ? (
          <p className="text-center text-sm text-[#6b7a99]">
            아직 기록이 없어요. 첫 번째 플레이어입니다! 🏆
          </p>
        ) : (
          <ol className="space-y-2">
            {ranking.map((entry, i) => {
              const is_me = entry.sns_id === sns_id;
              return (
                <li
                  key={i}
                  className={[
                    "flex items-center justify-between rounded-2xl px-4 py-3",
                    is_me ? "bg-[#1a2744] text-white" : "bg-[#fdf8f0] text-[#1a2744]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <span className={[
                      "w-6 text-center text-sm font-black",
                      i === 0 ? "text-[#f59e0b]" : is_me ? "text-white/70" : "text-[#6b7a99]",
                    ].join(" ")}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                    </span>
                    <span className="text-sm font-bold">
                      {is_me ? "나" : maskId(entry.sns_id)}
                    </span>
                  </div>
                  <span className="font-display text-lg font-black">
                    {entry.score}
                    <span className="ml-0.5 text-xs font-bold opacity-60">점</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={onRestart}
          className="w-full rounded-2xl bg-[#4caf72] py-4 text-base font-extrabold text-white transition-all hover:bg-[#5ecb87] active:scale-[0.98]"
        >
          ↺ 재도전
        </button>
        <a
          href={`/sessions/${session_id}`}
          className="flex w-full items-center justify-center rounded-2xl border-2 border-[#e8ecf5] bg-white py-4 text-base font-extrabold text-[#6b7a99] transition-colors hover:border-[#1a2744] hover:text-[#1a2744]"
        >
          학습 목록으로 →
        </a>
      </div>
    </div>
  );
}
