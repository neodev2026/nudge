/**
 * /products/:slug/marathon
 *
 * Marathon Mode — all learning stages streamed end-to-end.
 *
 * Phases (client-side state machine):
 *   entry       — start / resume choice
 *   stream      — card-by-card display with TTS auto-play
 *   mini_quiz   — 5 questions every 5 stages (not saved)
 *   review_quiz — N questions every 50 stages (not saved)
 *   final_quiz  — all stages quiz at completion (saved to DB)
 *   complete    — redirect to result page
 *
 * TTS: auto-plays twice on title/example cards, then stops.
 * Settings: stored in localStorage.
 */
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { redirect } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  getMarathonProduct,
  getMarathonStages,
  checkMarathonSubscription,
  getMarathonInProgressRun,
  type MarathonStage,
} from "../lib/queries.server";
import type { V2CardData } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { slug } = params;
  if (!slug) throw new Response("Not Found", { status: 404 });

  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();

  // Allow anonymous (unauthenticated) access for preview — no progress saved.
  const userId = user?.id ?? null;

  const { createClient } = await import("@supabase/supabase-js");
  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const product = await getMarathonProduct(adminClient, slug);
  if (!product) throw new Response("Not Found", { status: 404 });

  if (userId) {
    const has_subscription = await checkMarathonSubscription(
      adminClient,
      userId,
      product.id
    );
    if (!has_subscription) {
      throw redirect(`/products/${slug}`);
    }
  }

  const [stages, in_progress_run] = await Promise.all([
    getMarathonStages(adminClient, product.id),
    userId
      ? getMarathonInProgressRun(adminClient, userId, product.id)
      : Promise.resolve(null),
  ]);

  return {
    productSlug: slug,
    productName: product.name,
    productId: product.id,
    userId,
    stages,
    inProgressRun: in_progress_run
      ? {
          id: in_progress_run.id,
          run_number: in_progress_run.run_number,
          last_stage_index: in_progress_run.last_stage_index,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// TTS — module-level generation counter shared across cards.
// Each stopTts() increments _tts_gen; every playTtsTwice() invocation captures
// its own generation at call time. Stale onend/onerror callbacks check the
// generation before proceeding, which prevents React Strict Mode's effect
// double-invoke from letting a cancelled utterance's delayed onend callback
// re-enter a new invocation's speak() loop.
// ---------------------------------------------------------------------------

let _tts_gen = 0;

function stopTts() {
  _tts_gen++;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// Plays an ordered list of utterances in sequence, 300ms apart.
// Each stopTts() increments _tts_gen; this function captures my_gen at call
// time and bails on any stale callback, making it safe under React Strict Mode
// double-invoke and card-change cleanups.
function playTtsSequence(
  steps: Array<{ text: string; lang: string; rate?: number }>,
  onDone?: () => void
) {
  stopTts();
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const my_gen = _tts_gen;
  let step_idx = 0;
  const playNext = () => {
    if (_tts_gen !== my_gen) return;
    if (step_idx >= steps.length) { onDone?.(); return; }
    const { text, lang, rate = 0.9 } = steps[step_idx++];
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    utt.rate = rate;
    utt.onend = () => { if (_tts_gen === my_gen) setTimeout(playNext, 300); };
    utt.onerror = () => { /* intentionally empty */ };
    window.speechSynthesis.speak(utt);
  };
  playNext();
}

function playTtsTwice(text: string, lang: string, onDone?: () => void, rate = 0.9) {
  playTtsSequence([{ text, lang, rate }, { text, lang, rate }], onDone);
}

const TTS_LANG_MAP: Record<string, string> = {
  de: "de-DE",
  en: "en-US",
  ja: "ja-JP",
  ko: "ko-KR",
  fr: "fr-FR",
  es: "es-ES",
};

function getTtsLang(card_data: V2CardData | null | undefined): string {
  return TTS_LANG_MAP[card_data?.meta?.target_locale ?? "de"] ?? "de-DE";
}

function hasTts(card_type: string): boolean {
  return card_type === "title" || card_type === "example" || card_type === "description";
}

type TtsStep = { text: string; lang: string; rate: number };

// Returns the auto-play sequence for a card on entry.
// title/example: front → back → front → back (interleaved for memorization)
// description:   back → back (Korean explanation, read twice)
function getTtsAutoPlaySteps(
  card_type: string,
  data: V2CardData,
  target_lang: string
): TtsStep[] | null {
  if (card_type === "title" || card_type === "example") {
    const front = data.presentation?.front;
    const back = data.presentation?.back;
    if (!front) return null;
    const f: TtsStep = { text: front, lang: target_lang, rate: 0.9 };
    const b: TtsStep | null = back ? { text: back, lang: "ko-KR", rate: 0.9 * 1.2 } : null;
    return b ? [f, b, f, b] : [f, f];
  }
  if (card_type === "description") {
    const text = data.presentation?.back;
    if (!text) return null;
    const s: TtsStep = { text, lang: "ko-KR", rate: 0.9 * 1.2 };
    return [s, s];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

interface MarathonSettings {
  auto_advance: boolean;
  auto_advance_delay: number; // seconds
  quiz_time_limit: boolean;
  quiz_time_limit_seconds: number;
  review_quiz_cumulative: boolean;
  skip_mini_quiz: boolean;
  skip_review_quiz: boolean;
}

const DEFAULT_SETTINGS: MarathonSettings = {
  auto_advance: false,
  auto_advance_delay: 3,
  quiz_time_limit: false,
  quiz_time_limit_seconds: 8,
  review_quiz_cumulative: false,
  skip_mini_quiz: false,
  skip_review_quiz: false,
};

function loadSettings(): MarathonSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem("marathon_settings");
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: MarathonSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem("marathon_settings", JSON.stringify(s));
}

// ---------------------------------------------------------------------------
// Quiz generation
// ---------------------------------------------------------------------------

interface QuizQuestion {
  stage_id: string;
  question: string;
  question_direction: "word_to_meaning" | "meaning_to_word";
  correct_answer: string;
  options: string[];
}

function getStageWordMeaning(stage: MarathonStage): {
  word: string;
  meaning: string;
} {
  const title_card = stage.cards.find((c) => c.card_type === "title");
  const data = title_card?.card_data as V2CardData | undefined;
  return {
    word: data?.presentation?.front ?? stage.title,
    meaning: data?.presentation?.back ?? "",
  };
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateQuizQuestions(
  target_stages: MarathonStage[],
  all_stages: MarathonStage[]
): QuizQuestion[] {
  return target_stages.map((stage) => {
    const { word, meaning } = getStageWordMeaning(stage);
    const direction: "word_to_meaning" | "meaning_to_word" =
      Math.random() < 0.5 ? "word_to_meaning" : "meaning_to_word";

    const correct = direction === "word_to_meaning" ? meaning : word;

    const other_stages = all_stages.filter((s) => s.id !== stage.id);
    const distractors = shuffleArray(other_stages)
      .slice(0, 3)
      .map((s) => {
        const { word: w, meaning: m } = getStageWordMeaning(s);
        return direction === "word_to_meaning" ? m : w;
      })
      .filter((d) => d !== correct);

    // Pad with fallback if not enough unique distractors
    while (distractors.length < 3) {
      distractors.push(`(보기 ${distractors.length + 1})`);
    }

    const options = shuffleArray([correct, ...distractors.slice(0, 3)]);

    return {
      stage_id: stage.id,
      question: direction === "word_to_meaning" ? word : meaning,
      question_direction: direction,
      correct_answer: correct,
      options,
    };
  });
}

// ---------------------------------------------------------------------------
// Phase types
// ---------------------------------------------------------------------------

type Phase =
  | { type: "entry" }
  | { type: "stream" }
  | { type: "mini_quiz"; questions: QuizQuestion[]; completed_count: number; follow_up_review?: { questions: QuizQuestion[]; completed_count: number } }
  | { type: "review_quiz"; questions: QuizQuestion[]; completed_count: number }
  | { type: "final_quiz"; questions: QuizQuestion[] }
  | { type: "complete" };

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function MarathonPage() {
  const { productSlug, productName, productId, userId, stages, inProgressRun } =
    useLoaderData<typeof loader>();

  const navigate = useNavigate();
  const start_fetcher = useFetcher<{ ok: boolean; run_id: string; last_stage_index: number }>();
  const save_fetcher = useFetcher();
  const complete_fetcher = useFetcher<{ ok: boolean }>();

  const [phase, set_phase] = useState<Phase>({ type: "entry" });
  const [run_id, set_run_id] = useState<string | null>(
    inProgressRun?.id ?? null
  );
  const [current_stage_idx, set_current_stage_idx] = useState(0);
  const [current_card_idx, set_current_card_idx] = useState(0);
  const [settings, set_settings] = useState<MarathonSettings>(DEFAULT_SETTINGS);
  const [show_settings, set_show_settings] = useState(false);
  const [final_answers, set_final_answers] = useState<
    Array<{ stage_id: string; question_direction: string; is_correct: boolean }>
  >([]);
  const started_at_ref = useRef<Date>(new Date());
  const quiz_only_ref = useRef(false);
  const jump_stage_ref = useRef<number | null>(null); // 0-based target index

  // Load settings from localStorage after mount
  useEffect(() => {
    set_settings(loadSettings());
  }, []);

  // Handle start API response
  useEffect(() => {
    if (start_fetcher.data?.ok) {
      const { run_id: new_run_id, last_stage_index } = start_fetcher.data;
      set_run_id(new_run_id);
      started_at_ref.current = new Date();
      if (quiz_only_ref.current) {
        quiz_only_ref.current = false;
        const questions = generateQuizQuestions(stages, stages);
        set_final_answers([]);
        set_phase({ type: "final_quiz", questions });
      } else if (jump_stage_ref.current !== null) {
        const target_idx = jump_stage_ref.current;
        jump_stage_ref.current = null;
        set_current_stage_idx(target_idx);
        set_current_card_idx(0);
        set_phase({ type: "stream" });
        save_fetcher.submit(
          { last_stage_index: target_idx },
          { method: "POST", action: `/api/v2/marathon/${new_run_id}/save-progress`, encType: "application/json" }
        );
      } else {
        set_current_stage_idx(last_stage_index);
        set_current_card_idx(0);
        set_phase({ type: "stream" });
      }
    }
  }, [start_fetcher.data]);

  // Handle complete API response → navigate to result
  useEffect(() => {
    if (complete_fetcher.data?.ok) {
      navigate(`/products/${productSlug}/marathon/result/${run_id}`);
    }
  }, [complete_fetcher.data]);

  // Anon mode: complete phase has no run_id to save — navigate back to product page
  useEffect(() => {
    if (phase.type === "complete" && !run_id) {
      navigate(`/products/${productSlug}`);
    }
  }, [phase.type, run_id]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  function handleResume() {
    if (!inProgressRun) return;
    set_run_id(inProgressRun.id);
    set_current_stage_idx(inProgressRun.last_stage_index);
    set_current_card_idx(0);
    started_at_ref.current = new Date();
    set_phase({ type: "stream" });
  }

  function handleStart(restart: boolean) {
    if (!userId) {
      // Anon mode: no DB run — transition directly without calling the start API.
      started_at_ref.current = new Date();
      if (quiz_only_ref.current) {
        quiz_only_ref.current = false;
        const questions = generateQuizQuestions(stages, stages);
        set_final_answers([]);
        set_phase({ type: "final_quiz", questions });
      } else {
        const target_idx = jump_stage_ref.current ?? 0;
        jump_stage_ref.current = null;
        set_current_stage_idx(target_idx);
        set_current_card_idx(0);
        set_phase({ type: "stream" });
      }
      return;
    }
    start_fetcher.submit(
      { restart },
      {
        method: "POST",
        action: `/api/v2/marathon/${productSlug}/start`,
        encType: "application/json",
      }
    );
  }

  function handleQuickQuiz() {
    quiz_only_ref.current = true;
    handleStart(true);
  }

  function handleJumpToStage(stage_num: number) {
    jump_stage_ref.current = stage_num - 1; // convert to 0-based index
    handleStart(true);
  }

  function handlePause() {
    stopTts();
    set_phase({ type: "entry" });
  }

  function handleJumpToReview() {
    const completed = current_stage_idx;
    const next_50 = (Math.floor(completed / 50) + 1) * 50;
    if (next_50 > stages.length) return;
    stopTts();
    if (run_id) {
      save_fetcher.submit(
        { last_stage_index: next_50 },
        { method: "POST", action: `/api/v2/marathon/${run_id}/save-progress`, encType: "application/json" }
      );
    }
    const range_start = settings.review_quiz_cumulative ? 0 : next_50 - 50;
    const target = stages.slice(range_start, next_50);
    const questions = generateQuizQuestions(target, stages);
    set_current_stage_idx(next_50);
    set_current_card_idx(0);
    set_phase({ type: "review_quiz", questions, completed_count: next_50 });
  }

  function handleNextCard() {
    stopTts();
    const stage = stages[current_stage_idx];
    if (!stage) return;

    if (current_card_idx < stage.cards.length - 1) {
      // More cards in this stage
      set_current_card_idx((i) => i + 1);
    } else {
      // Stage complete — advance to next stage
      const next_idx = current_stage_idx + 1;

      // Save progress
      if (run_id) {
        save_fetcher.submit(
          { last_stage_index: next_idx },
          {
            method: "POST",
            action: `/api/v2/marathon/${run_id}/save-progress`,
            encType: "application/json",
          }
        );
      }

      const completed_count = next_idx; // number of stages completed

      if (completed_count >= stages.length) {
        // All stages done — generate final quiz
        const questions = generateQuizQuestions(stages, stages);
        set_final_answers([]);
        set_phase({ type: "final_quiz", questions });
        return;
      }

      // Check quiz trigger.
      // At multiples of 50: mini quiz runs first (if enabled), then review quiz
      // follows via follow_up_review. This preserves the natural learning flow
      // instead of skipping the mini quiz checkpoint.
      set_current_stage_idx(next_idx);
      set_current_card_idx(0);

      if (completed_count % 50 === 0) {
        const has_review = !settings.skip_review_quiz;
        const has_mini = !settings.skip_mini_quiz;
        const range_start = settings.review_quiz_cumulative ? 0 : completed_count - 50;
        const review_questions = has_review
          ? generateQuizQuestions(stages.slice(range_start, completed_count), stages)
          : null;
        const mini_questions = has_mini
          ? generateQuizQuestions(stages.slice(completed_count - 5, completed_count), stages)
          : null;

        if (mini_questions) {
          set_phase({
            type: "mini_quiz",
            questions: mini_questions,
            completed_count,
            follow_up_review: review_questions
              ? { questions: review_questions, completed_count }
              : undefined,
          });
        } else if (review_questions) {
          set_phase({ type: "review_quiz", questions: review_questions, completed_count });
        }
      } else if (completed_count % 5 === 0 && !settings.skip_mini_quiz) {
        const target = stages.slice(completed_count - 5, completed_count);
        const questions = generateQuizQuestions(target, stages);
        set_phase({ type: "mini_quiz", questions, completed_count });
      }
    }
  }

  function handleQuizDone() {
    if (phase.type === "mini_quiz" && phase.follow_up_review) {
      const { questions, completed_count } = phase.follow_up_review;
      set_phase({ type: "review_quiz", questions, completed_count });
    } else {
      set_phase({ type: "stream" });
    }
  }

  function handleFinalQuizDone(
    answers?: Array<{
      stage_id: string;
      question_direction: string;
      is_correct: boolean;
    }>
  ) {
    const safe_answers = answers ?? [];
    const score = safe_answers.filter((a) => a.is_correct).length;
    const elapsed = Math.round(
      (new Date().getTime() - started_at_ref.current.getTime()) / 1000
    );

    if (run_id) {
      complete_fetcher.submit(
        {
          score,
          total_questions: safe_answers.length,
          elapsed_seconds: elapsed,
          answers: safe_answers,
        },
        {
          method: "POST",
          action: `/api/v2/marathon/${run_id}/complete`,
          encType: "application/json",
        }
      );
    }
    set_phase({ type: "complete" });
  }

  function handleSettingsChange(next: MarathonSettings) {
    set_settings(next);
    saveSettings(next);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (phase.type === "entry") {
    return (
      <EntryView
        product_name={productName}
        product_slug={productSlug}
        total_stages={stages.length}
        in_progress_run={inProgressRun}
        is_starting={start_fetcher.state !== "idle"}
        settings={settings}
        show_settings={show_settings}
        on_show_settings={() => set_show_settings(true)}
        on_hide_settings={() => set_show_settings(false)}
        on_settings_change={handleSettingsChange}
        on_resume={handleResume}
        on_start={() => handleStart(false)}
        on_restart={() => handleStart(true)}
        on_quick_quiz={handleQuickQuiz}
        on_jump_to_stage={handleJumpToStage}
      />
    );
  }

  if (phase.type === "stream") {
    const stage = stages[current_stage_idx];
    if (!stage) return null;
    return (
      <StreamView
        stage={stage}
        stage_index={current_stage_idx}
        card_index={current_card_idx}
        total_stages={stages.length}
        settings={settings}
        show_settings={show_settings}
        on_show_settings={() => set_show_settings(true)}
        on_hide_settings={() => set_show_settings(false)}
        on_settings_change={handleSettingsChange}
        on_next={handleNextCard}
        on_pause={handlePause}
        on_jump_to_review={
          (Math.floor(current_stage_idx / 50) + 1) * 50 <= stages.length
            ? handleJumpToReview
            : null
        }
      />
    );
  }

  if (phase.type === "mini_quiz" || phase.type === "review_quiz") {
    const quiz_tts_lang = getTtsLang(
      stages[0]?.cards.find((c) => c.card_type === "title")?.card_data as V2CardData | undefined
    );
    return (
      <QuizView
        key={`${phase.type}-${phase.completed_count}`}
        questions={phase.questions}
        quiz_label={
          phase.type === "review_quiz"
            ? settings.review_quiz_cumulative
              ? `복습 퀴즈 · 누적 ${phase.completed_count}개`
              : `복습 퀴즈 · ${phase.completed_count - 50 + 1}~${phase.completed_count}번`
            : `미니 퀴즈 · ${phase.completed_count}개 완료`
        }
        settings={settings}
        save_answers={false}
        tts_lang={quiz_tts_lang}
        on_done={handleQuizDone}
      />
    );
  }

  if (phase.type === "final_quiz") {
    return (
      <QuizView
        questions={phase.questions}
        quiz_label="최종 퀴즈"
        settings={settings}
        save_answers={true}
        on_done={handleFinalQuizDone}
      />
    );
  }

  // complete phase — show loading while API call is in flight
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fdf8f0]">
      <div className="text-center">
        <div className="text-4xl mb-4">🏁</div>
        <p className="font-bold text-[#1a2744]">완주 기록 저장 중...</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntryView
// ---------------------------------------------------------------------------

function EntryView({
  product_name,
  product_slug,
  total_stages,
  in_progress_run,
  is_starting,
  settings,
  show_settings,
  on_show_settings,
  on_hide_settings,
  on_settings_change,
  on_resume,
  on_start,
  on_restart,
  on_quick_quiz,
  on_jump_to_stage,
}: {
  product_name: string;
  product_slug: string;
  total_stages: number;
  in_progress_run: { id: string; run_number: number; last_stage_index: number } | null;
  is_starting: boolean;
  settings: MarathonSettings;
  show_settings: boolean;
  on_show_settings: () => void;
  on_hide_settings: () => void;
  on_settings_change: (s: MarathonSettings) => void;
  on_resume: () => void;
  on_start: () => void;
  on_restart: () => void;
  on_quick_quiz: () => void;
  on_jump_to_stage: (stage_num: number) => void;
}) {
  const [jump_input, set_jump_input] = useState("");
  const has_progress =
    in_progress_run && in_progress_run.last_stage_index > 0;

  return (
    <div className="min-h-screen bg-[#fdf8f0] flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <a
            href={`/products/${product_slug}`}
            className="text-xs font-semibold text-[#6b7a99] hover:text-[#1a2744]"
          >
            ← 상품 페이지
          </a>
          <button
            onClick={on_show_settings}
            className="text-xs font-semibold text-[#6b7a99] hover:text-[#1a2744] flex items-center gap-1"
          >
            ⚙️ 설정
          </button>
        </div>

        {/* Hero */}
        <div className="rounded-3xl bg-white p-8 shadow-[0_8px_40px_rgba(26,39,68,0.10)] mb-6 text-center">
          <div className="text-5xl mb-4">🏃</div>
          <h1 className="font-display text-2xl font-black text-[#1a2744] mb-1">
            마라톤 모드
          </h1>
          <p className="text-sm text-[#6b7a99] mb-1">{product_name}</p>
          <p className="text-xs text-[#9aa3b5]">전체 {total_stages}개 단어</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {has_progress ? (
            <>
              <button
                onClick={on_resume}
                disabled={is_starting}
                className="w-full rounded-2xl bg-[#1a2744] py-4 text-base font-extrabold text-white transition-all hover:bg-[#243358] disabled:opacity-60 active:scale-[0.98]"
              >
                {in_progress_run.last_stage_index + 1}번째 단어부터 이어하기 →
              </button>
              <button
                onClick={on_restart}
                disabled={is_starting}
                className="w-full rounded-2xl border-2 border-[#e8ecf5] bg-white py-4 text-base font-extrabold text-[#6b7a99] transition-colors hover:border-[#1a2744] hover:text-[#1a2744] disabled:opacity-60"
              >
                {is_starting ? "준비 중..." : "처음부터 시작"}
              </button>
              <button
                onClick={on_quick_quiz}
                disabled={is_starting}
                className="w-full rounded-2xl border-2 border-[#e8ecf5] bg-white py-4 text-base font-extrabold text-[#6b7a99] transition-colors hover:border-[#1a2744] hover:text-[#1a2744] disabled:opacity-60"
              >
                {is_starting ? "준비 중..." : "전체 퀴즈 바로 시작 →"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={in_progress_run ? on_restart : on_start}
                disabled={is_starting}
                className="w-full rounded-2xl bg-[#1a2744] py-4 text-base font-extrabold text-white transition-all hover:bg-[#243358] disabled:opacity-60 active:scale-[0.98]"
              >
                {is_starting ? "준비 중..." : "마라톤 시작 →"}
              </button>
              <button
                onClick={on_quick_quiz}
                disabled={is_starting}
                className="w-full rounded-2xl border-2 border-[#e8ecf5] bg-white py-4 text-base font-extrabold text-[#6b7a99] transition-colors hover:border-[#1a2744] hover:text-[#1a2744] disabled:opacity-60"
              >
                {is_starting ? "준비 중..." : "전체 퀴즈 바로 시작 →"}
              </button>
            </>
          )}

          {/* Print link */}
          <a
            href={`/products/${product_slug}/marathon/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-2xl border-2 border-[#e8ecf5] bg-white py-3 text-sm font-bold text-[#6b7a99] text-center transition-colors hover:border-[#1a2744] hover:text-[#1a2744]"
          >
            🖨️ 전체 출력
          </a>

          {/* Stage jump */}
          <div className="flex gap-2 mt-1">
            <input
              type="number"
              min={1}
              max={total_stages}
              value={jump_input}
              onChange={(e) => set_jump_input(e.target.value)}
              placeholder={`1 ~ ${total_stages}`}
              className="flex-1 rounded-2xl border-2 border-[#e8ecf5] bg-white px-4 py-3 text-sm font-bold text-[#1a2744] placeholder:text-[#c0c7d6] focus:border-[#1a2744] outline-none"
            />
            <button
              disabled={is_starting || !jump_input || Number(jump_input) < 1 || Number(jump_input) > total_stages}
              onClick={() => {
                const n = Number(jump_input);
                if (n >= 1 && n <= total_stages) on_jump_to_stage(n);
              }}
              className="rounded-2xl bg-[#1a2744] px-5 py-3 text-sm font-extrabold text-white transition-all hover:bg-[#243358] disabled:opacity-40 active:scale-[0.98]"
            >
              이동 →
            </button>
          </div>
        </div>
      </div>

      {show_settings && (
        <SettingsPanel
          settings={settings}
          on_change={on_settings_change}
          on_close={on_hide_settings}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StreamView
// ---------------------------------------------------------------------------

function StreamView({
  stage,
  stage_index,
  card_index,
  total_stages,
  settings,
  show_settings,
  on_show_settings,
  on_hide_settings,
  on_settings_change,
  on_next,
  on_pause,
  on_jump_to_review,
}: {
  stage: MarathonStage;
  stage_index: number;
  card_index: number;
  total_stages: number;
  settings: MarathonSettings;
  show_settings: boolean;
  on_show_settings: () => void;
  on_hide_settings: () => void;
  on_settings_change: (s: MarathonSettings) => void;
  on_next: () => void;
  on_pause: () => void;
  on_jump_to_review: (() => void) | null;
}) {
  const card = stage.cards[card_index];
  const data = card?.card_data as V2CardData;
  const tts_lang = getTtsLang(data);
  const has_tts = hasTts(card?.card_type ?? "");

  const [countdown, set_countdown] = useState<number | null>(null);
  const countdown_ref = useRef<ReturnType<typeof setInterval> | null>(null);
  // Read settings/on_next via refs so effect deps stay as [stage_index, card_index]
  // and loadSettings() firing after mount doesn't re-trigger the effect.
  const settings_ref = useRef(settings);
  settings_ref.current = settings;
  const on_next_ref = useRef(on_next);
  on_next_ref.current = on_next;
  // Incremented each time the card changes. TTS onDone closures check this to
  // guard against stale callbacks firing after the card has already advanced
  // (e.g. when speechSynthesis.cancel() triggers onerror on some browsers).
  const gen_ref = useRef(0);

  // Auto-play TTS on card entry, then start auto-advance countdown if enabled.
  // Single effect avoids stale-state issue: when moving from a TTS card to a
  // non-TTS card, tts_done would stay `true` (no change), so a separate effect
  // gated on tts_done would never re-fire. Calling startCountdown() directly
  // from the TTS callback (or immediately for non-TTS cards) sidesteps this.
  //
  // on_next MUST NOT be called inside a useState functional-update callback —
  // React Strict Mode invokes those callbacks twice for side-effect detection,
  // which caused description cards to be skipped (on_next fired twice per card).
  // Use a local `ticks` variable and call on_next_ref.current() directly.
  useEffect(() => {
    gen_ref.current += 1;
    const my_gen = gen_ref.current;

    set_countdown(null);
    if (countdown_ref.current) clearInterval(countdown_ref.current);

    const startCountdown = () => {
      if (gen_ref.current !== my_gen) return; // stale TTS callback — card already changed
      const s = settings_ref.current;
      if (!s.auto_advance) return;
      let ticks = s.auto_advance_delay;
      set_countdown(ticks);
      countdown_ref.current = setInterval(() => {
        ticks -= 1;
        if (ticks <= 0) {
          clearInterval(countdown_ref.current!);
          countdown_ref.current = null;
          set_countdown(null);
          on_next_ref.current();
        } else {
          set_countdown(ticks);
        }
      }, 1000);
    };

    const steps = has_tts && data ? getTtsAutoPlaySteps(card?.card_type ?? "", data, tts_lang) : null;
    if (steps) {
      playTtsSequence(steps, startCountdown);
    } else {
      startCountdown();
    }

    return () => {
      stopTts();
      if (countdown_ref.current) clearInterval(countdown_ref.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage_index, card_index]);

  function handleNext() {
    if (countdown_ref.current) clearInterval(countdown_ref.current);
    set_countdown(null);
    on_next();
  }

  const progress_pct = Math.round((stage_index / total_stages) * 100);
  const CARD_TYPE_LABELS: Record<string, string> = {
    title: "단어",
    description: "설명",
    image: "이미지",
    etymology: "어원",
    example: "예문",
    option: "선택",
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#fdf8f0] px-4 py-6">
      {/* Top bar */}
      <div className="w-full max-w-md mb-4">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={on_pause}
            className="text-xs font-semibold text-[#6b7a99] hover:text-[#1a2744]"
          >
            ⏸ 일시정지
          </button>
          <span className="text-xs text-[#9aa3b5]">
            {stage_index + 1} / {total_stages}
          </span>
          <button
            onClick={on_show_settings}
            className="text-xs font-semibold text-[#6b7a99] hover:text-[#1a2744]"
          >
            ⚙️
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-[#e8ecf5]">
          <div
            className="h-2 rounded-full bg-[#4caf72] transition-all duration-300"
            style={{ width: `${progress_pct}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md flex flex-col flex-1">
        <div className="rounded-3xl bg-white p-8 shadow-[0_8px_40px_rgba(26,39,68,0.10)]">
          <span className="mb-5 inline-block rounded-lg bg-[#fdf8f0] px-3 py-1 text-[0.68rem] font-black uppercase tracking-wide text-[#6b7a99]">
            {CARD_TYPE_LABELS[card?.card_type ?? ""] ?? card?.card_type}
          </span>

          {card?.card_type === "title" && (
            <>
              <div className="mb-1 font-display text-[2.4rem] font-black leading-tight text-[#1a2744]">
                {data.presentation.front}
              </div>
              <div className="text-lg font-bold text-[#4caf72]">
                {data.presentation.back}
              </div>
              {has_tts && (
                <button
                  onClick={() => playTtsSequence([
                    { text: data.presentation.front, lang: tts_lang, rate: 0.9 },
                    ...(data.presentation.back ? [{ text: data.presentation.back, lang: "ko-KR", rate: 0.9 * 1.2 }] : []),
                  ])}
                  className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold bg-[#fdf8f0] text-[#6b7a99] hover:bg-[#e8ecf5] hover:text-[#1a2744]"
                >
                  <span>🔊</span> 발음 듣기
                </button>
              )}
            </>
          )}

          {card?.card_type === "description" && (
            <>
              <div className="rounded-2xl bg-[#fdf8f0] p-5 text-base leading-[1.8] font-bold text-[#1a2744]">
                {data.presentation.back}
              </div>
              <button
                onClick={() => playTtsTwice(data.presentation.back, "ko-KR", undefined, 0.9 * 1.2)}
                className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold bg-[#fdf8f0] text-[#6b7a99] hover:bg-[#e8ecf5] hover:text-[#1a2744]"
              >
                <span>🔊</span> 다시 듣기
              </button>
            </>
          )}

          {card?.card_type === "example" && (
            <>
              <p className="mb-3 text-base font-bold leading-[1.8] text-[#1a2744]">
                {data.presentation.front}
              </p>
              <p className="text-sm text-[#6b7a99]">{data.presentation.back}</p>
              {has_tts && (
                <button
                  onClick={() => playTtsSequence([
                    { text: data.presentation.front, lang: tts_lang, rate: 0.9 },
                    ...(data.presentation.back ? [{ text: data.presentation.back, lang: "ko-KR", rate: 0.9 * 1.2 }] : []),
                  ])}
                  className="mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold bg-[#fdf8f0] text-[#6b7a99] hover:bg-[#e8ecf5] hover:text-[#1a2744]"
                >
                  <span>🔊</span> 발음 듣기
                </button>
              )}
            </>
          )}

          {card?.card_type === "etymology" && (
            <div className="rounded-2xl bg-[#fdf8f0] p-5 text-base leading-[1.8] text-[#1a2744]">
              <p>{data.presentation.front}</p>
              {data.presentation.back && (
                <p className="mt-2 text-sm text-[#6b7a99]">{data.presentation.back}</p>
              )}
            </div>
          )}

          {card?.card_type === "image" && (
            <div className="overflow-hidden rounded-2xl">
              <img
                src={data.presentation.front}
                alt={data.presentation.back}
                className="w-full object-cover"
              />
              {data.presentation.back && (
                <p className="mt-2 text-sm text-[#6b7a99]">{data.presentation.back}</p>
              )}
            </div>
          )}

          {!["title", "description", "example", "etymology", "image"].includes(
            card?.card_type ?? ""
          ) && (
            <>
              <p className="mb-3 text-base font-bold text-[#1a2744]">
                {data?.presentation?.front}
              </p>
              {data?.presentation?.back && (
                <p className="text-sm text-[#6b7a99]">{data.presentation.back}</p>
              )}
            </>
          )}

          {data?.details?.explanation && (
            <p className="mt-5 text-sm leading-[1.7] text-[#6b7a99]">
              {data.details.explanation}
            </p>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          className="mt-5 w-full rounded-2xl bg-[#1a2744] py-4 text-base font-extrabold text-white transition-all hover:bg-[#243358] active:scale-[0.98] flex items-center justify-center gap-2"
        >
          다음 →
          {countdown !== null && (
            <span className="text-sm font-normal opacity-70">({countdown})</span>
          )}
        </button>

        <p className="mt-3 text-center text-xs text-[#6b7a99]">
          카드 {card_index + 1} / {stage.cards.length}
        </p>

        {on_jump_to_review && (
          <button
            type="button"
            onClick={on_jump_to_review}
            className="mt-1 w-full text-xs text-[#9aa3b5] hover:text-[#6b7a99] text-center py-1 underline underline-offset-2"
          >
            다음 50 스테이지 퀴즈로 점프
          </button>
        )}
      </div>

      {show_settings && (
        <SettingsPanel
          settings={settings}
          on_change={on_settings_change}
          on_close={on_hide_settings}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuizView — shared for mini, review, final quiz
// ---------------------------------------------------------------------------

function QuizView({
  questions,
  quiz_label,
  settings,
  save_answers,
  tts_lang,
  on_done,
}: {
  questions: QuizQuestion[];
  quiz_label: string;
  settings: MarathonSettings;
  save_answers: boolean;
  tts_lang?: string;
  on_done: (
    answers?: Array<{
      stage_id: string;
      question_direction: string;
      is_correct: boolean;
    }>
  ) => void;
}) {
  const [q_index, set_q_index] = useState(0);
  const [selected, set_selected] = useState<string | null>(null);
  const [confirmed, set_confirmed] = useState(false);
  const [time_left, set_time_left] = useState<number | null>(null);
  const [collected_answers, set_collected_answers] = useState<
    Array<{ stage_id: string; question_direction: string; is_correct: boolean }>
  >([]);
  const [auto_next, set_auto_next] = useState(false);
  const [auto_next_count, set_auto_next_count] = useState<number | null>(null);

  const q = questions[q_index];
  const timer_ref = useRef<ReturnType<typeof setInterval> | null>(null);
  // Always points to the latest handleNext to avoid stale closures in timer callbacks
  const handle_next_ref = useRef<(() => void) | null>(null);

  // Init timer on question change
  useEffect(() => {
    set_selected(null);
    set_confirmed(false);
    if (timer_ref.current) clearInterval(timer_ref.current);

    if (settings.quiz_time_limit) {
      set_time_left(settings.quiz_time_limit_seconds);
      timer_ref.current = setInterval(() => {
        set_time_left((t) => {
          if (t === null || t <= 1) {
            clearInterval(timer_ref.current!);
            // Auto-submit as incorrect, then auto-advance after showing correct answer
            handleSelect("__timeout__");
            setTimeout(() => handle_next_ref.current?.(), 1500);
            return null;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      set_time_left(null);
    }

    return () => {
      if (timer_ref.current) clearInterval(timer_ref.current);
    };
  }, [q_index, settings.quiz_time_limit, settings.quiz_time_limit_seconds]);

  // Auto-advance: 3 seconds after confirming an answer
  useEffect(() => {
    if (!confirmed || !auto_next) {
      set_auto_next_count(null);
      return;
    }
    set_auto_next_count(3);
    const iv = setInterval(
      () => set_auto_next_count((c) => (c !== null && c > 1 ? c - 1 : null)),
      1000
    );
    const tm = setTimeout(handleNext, 3000);
    return () => { clearInterval(iv); clearTimeout(tm); };
    // handleNext captures state that won't change during the 3-second window
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed, auto_next]);

  function handleSelect(option: string) {
    if (confirmed) return;
    if (timer_ref.current) clearInterval(timer_ref.current);
    set_selected(option);
    set_confirmed(true);
    set_time_left(null);
    if (tts_lang) {
      const word = q.question_direction === "word_to_meaning" ? q.question : q.correct_answer;
      playTtsTwice(word, tts_lang);
    }
  }

  // Keep ref current on every render so timer callbacks always call the latest version
  handle_next_ref.current = handleNext;

  function handleJumpToLast() {
    stopTts();
    if (q_index >= questions.length - 1) return;
    const skipped = questions.slice(q_index, questions.length - 1).map((sq) => ({
      stage_id: sq.stage_id,
      question_direction: sq.question_direction,
      is_correct: false,
    }));
    set_collected_answers((prev) => [...prev, ...skipped]);
    set_q_index(questions.length - 1);
    set_selected(null);
    set_confirmed(false);
    set_auto_next_count(null);
    if (timer_ref.current) clearInterval(timer_ref.current);
  }

  function handleNext() {
    stopTts();
    const is_correct = selected === q.correct_answer;
    const answer = {
      stage_id: q.stage_id,
      question_direction: q.question_direction,
      is_correct,
    };
    const new_answers = [...collected_answers, answer];
    set_collected_answers(new_answers);

    if (q_index < questions.length - 1) {
      set_q_index((i) => i + 1);
    } else {
      // All questions done
      on_done(save_answers ? new_answers : undefined);
    }
  }

  if (!q) return null;

  const is_correct = selected === q.correct_answer;

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#fdf8f0] px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="rounded-lg bg-[#1a2744] px-3 py-1 text-xs font-black text-white uppercase tracking-wide">
            {quiz_label}
          </span>
          <span className="text-xs text-[#9aa3b5]">
            {q_index + 1} / {questions.length}
          </span>
        </div>

        {/* Timer bar */}
        {time_left !== null && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-[#6b7a99]">남은 시간</span>
              <span className={`text-sm font-black tabular-nums ${time_left <= 3 ? "text-red-500" : "text-amber-500"}`}>
                {time_left}초
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#e8ecf5]">
              <div
                className={`h-2 rounded-full transition-all duration-1000 ${time_left <= 3 ? "bg-red-400" : "bg-amber-400"}`}
                style={{
                  width: `${(time_left / settings.quiz_time_limit_seconds) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Question */}
        <div className="rounded-3xl bg-white p-8 shadow-[0_8px_40px_rgba(26,39,68,0.10)] mb-4">
          <p className="text-xs text-[#6b7a99] mb-3">
            {q.question_direction === "word_to_meaning"
              ? "이 단어의 의미는?"
              : "이 의미에 해당하는 단어는?"}
          </p>
          <div className="font-display text-2xl font-black text-[#1a2744]">
            {q.question}
          </div>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2 mb-4">
          {q.options.map((opt) => {
            let cls =
              "w-full rounded-2xl border-2 py-3.5 px-4 text-sm font-bold text-left transition-colors ";
            if (!confirmed) {
              cls += "border-[#e8ecf5] bg-white text-[#1a2744] hover:border-[#1a2744]";
            } else if (opt === q.correct_answer) {
              cls += "border-[#4caf72] bg-[#4caf72]/10 text-[#1a2744]";
            } else if (opt === selected) {
              cls += "border-red-400 bg-red-50 text-red-700";
            } else {
              cls += "border-[#e8ecf5] bg-white text-[#9aa3b5]";
            }

            return (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                disabled={confirmed}
                className={cls}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {/* Feedback + Next */}
        {confirmed && (
          <div className="flex flex-col gap-2">
            <div
              className={`rounded-2xl px-4 py-3 text-sm font-bold text-center ${
                is_correct
                  ? "bg-[#4caf72]/10 text-[#4caf72]"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {is_correct ? "정답! ✓" : `오답 — 정답: ${q.correct_answer}`}
            </div>
            <button
              onClick={handleNext}
              className="w-full rounded-2xl bg-[#1a2744] py-4 text-base font-extrabold text-white hover:bg-[#243358] active:scale-[0.98]"
            >
              {q_index < questions.length - 1
                ? `다음 문제 →${auto_next_count !== null ? ` (${auto_next_count})` : ""}`
                : "완료 →"}
            </button>
          </div>
        )}

        {/* Auto-advance toggle + jump button — always visible */}
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-[#6b7a99]">3초 후 자동 넘김</span>
            <Toggle value={auto_next} on_change={set_auto_next} />
          </div>
          {q_index < questions.length - 1 && (
            <button
              onClick={handleJumpToLast}
              className="text-xs text-[#9aa3b5] hover:text-[#6b7a99] text-center py-1 underline underline-offset-2"
            >
              ⏭ 마지막 문제로 점프 (건너뛴 문제 오답 처리)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SettingsPanel — modal overlay
// ---------------------------------------------------------------------------

function SettingsPanel({
  settings,
  on_change,
  on_close,
}: {
  settings: MarathonSettings;
  on_change: (s: MarathonSettings) => void;
  on_close: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={on_close}
    >
      <div
        className="w-full max-w-md rounded-t-3xl bg-white p-6 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-[#1a2744]">마라톤 설정</h2>
          <button onClick={on_close} className="text-[#9aa3b5] hover:text-[#1a2744]">
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <SettingRow label="자동 넘김">
            <Toggle
              value={settings.auto_advance}
              on_change={(v) => on_change({ ...settings, auto_advance: v })}
            />
          </SettingRow>

          {settings.auto_advance && (
            <SettingRow label="대기 시간">
              <select
                value={settings.auto_advance_delay}
                onChange={(e) =>
                  on_change({
                    ...settings,
                    auto_advance_delay: Number(e.target.value),
                  })
                }
                className="rounded-lg border border-[#e8ecf5] px-3 py-1 text-sm text-[#1a2744]"
              >
                {[1, 2, 3, 5].map((s) => (
                  <option key={s} value={s}>
                    {s}초
                  </option>
                ))}
              </select>
            </SettingRow>
          )}

          <SettingRow label="퀴즈 시간제한">
            <Toggle
              value={settings.quiz_time_limit}
              on_change={(v) => on_change({ ...settings, quiz_time_limit: v })}
            />
          </SettingRow>

          {settings.quiz_time_limit && (
            <SettingRow label="제한 시간">
              <select
                value={settings.quiz_time_limit_seconds}
                onChange={(e) =>
                  on_change({
                    ...settings,
                    quiz_time_limit_seconds: Number(e.target.value),
                  })
                }
                className="rounded-lg border border-[#e8ecf5] px-3 py-1 text-sm text-[#1a2744]"
              >
                {[5, 8, 10, 15].map((s) => (
                  <option key={s} value={s}>
                    {s}초
                  </option>
                ))}
              </select>
            </SettingRow>
          )}

          <SettingRow label="미니 퀴즈 건너뛰기">
            <Toggle
              value={settings.skip_mini_quiz}
              on_change={(v) => on_change({ ...settings, skip_mini_quiz: v })}
            />
          </SettingRow>

          <SettingRow label="복습 퀴즈 건너뛰기">
            <Toggle
              value={settings.skip_review_quiz}
              on_change={(v) => on_change({ ...settings, skip_review_quiz: v })}
            />
          </SettingRow>

          <SettingRow label="복습 퀴즈 이전 내용 포함">
            <Toggle
              value={settings.review_quiz_cumulative}
              on_change={(v) =>
                on_change({ ...settings, review_quiz_cumulative: v })
              }
            />
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#374151]">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  value,
  on_change,
}: {
  value: boolean;
  on_change: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => on_change(!value)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        value ? "bg-[#4caf72]" : "bg-gray-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          value ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
