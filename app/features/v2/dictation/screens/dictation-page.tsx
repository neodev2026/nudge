/**
 * /dictation/:stageId?session=:sessionId
 *
 * Dictation stage — TTS plays the example sentence, user types what they hear.
 *
 * Flow per item:
 *   1. TTS plays automatically once on mount
 *   2. User types the sentence in the input field
 *   3. "확인" button → compare with answer:
 *      - Correct  : green feedback → next item
 *      - Wrong    : diff highlight → user can retry or skip
 *   4. After all items → POST result → redirect to session
 *
 * Scoring: each item is scored by character-level match ratio.
 */
import type { Route } from "./+types/dictation-page";

import { useLoaderData, useFetcher, Link } from "react-router";
import { useState, useEffect, useRef } from "react";
import { redirect } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import {
  getDictationStageContext,
  getDictationCardPool,
} from "../lib/queries.server";
import type { DictationItem } from "../lib/queries.server";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "받아쓰기 — Nudge" },
];

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

  const context = await getDictationStageContext(
    client,
    params.stageId,
    session_id
  );
  if (!context) {
    throw new Response("Stage or session not found", { status: 404 });
  }

  const { stage, session } = context;

  // Access control
  const { data: { user: auth_user } } = await client.auth.getUser();
  const is_authenticated = !!auth_user;

  const { getSessionIdentity } = await import(
    "~/features/v2/session/lib/queries.server"
  );
  const identity = await getSessionIdentity(client, session_id).catch(() => null);

  if (identity?.link_access === "members_only" && !is_authenticated) {
    const next = encodeURIComponent(
      `/dictation/${params.stageId}?session=${session_id}`
    );
    throw redirect(`/auth/discord/start?next=${next}`);
  }

  const auth_user_id = identity?.auth_user_id ?? (session as any).auth_user_id ?? null;

  const items = await getDictationCardPool(
    client,
    session.product_session_id,
    params.stageId
  );

  return {
    stage_id: params.stageId,
    from_chat,
    stage_title: stage.title,
    session_id,
    auth_user_id,
    items,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns an array of { char, correct } pairs for diff display.
 * Compares user input against the expected sentence (case/space insensitive).
 */
function diffChars(
  expected: string,
  actual: string
): Array<{ char: string; correct: boolean }> {
  const exp = expected.toLowerCase().replace(/\s+/g, " ").trim();
  const act = actual.toLowerCase().replace(/\s+/g, " ").trim();
  return expected.split("").map((char, i) => ({
    char,
    correct: char.toLowerCase() === (act[i] ?? "").toLowerCase(),
  }));
}

function calcScore(expected: string, actual: string): number {
  const exp = expected.toLowerCase().replace(/\s+/g, "");
  const act = actual.toLowerCase().replace(/\s+/g, "");
  if (exp.length === 0) return 100;
  let matches = 0;
  for (let i = 0; i < exp.length; i++) {
    if (exp[i] === act[i]) matches++;
  }
  return Math.round((matches / exp.length) * 100);
}

// ---------------------------------------------------------------------------
// TTS helper
// ---------------------------------------------------------------------------

function playTts(text: string, lang: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang;
  utt.rate = 0.85;
  window.speechSynthesis.speak(utt);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Phase = "listen" | "input" | "result";

export default function DictationPage() {
  const { stage_id, stage_title, session_id, auth_user_id, items, from_chat } =
    useLoaderData<typeof loader>();

  const [idx, set_idx] = useState(0);
  const [phase, set_phase] = useState<Phase>("listen");
  const [input_val, set_input_val] = useState("");
  const [score, set_score] = useState<number | null>(null);
  const [total_score, set_total_score] = useState(0);
  const [play_count, set_play_count] = useState(0);

  const input_ref = useRef<HTMLInputElement>(null);
  const result_fetcher = useFetcher<{ ok?: boolean }>();

  const current = items[idx];
  const is_last = idx === items.length - 1;
  const is_done = result_fetcher.data?.ok === true;

  // Auto-play TTS on each new item
  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(() => {
      playTts(current.sentence, current.tts_lang);
      set_play_count(1);
      set_phase("input");
    }, 400);
    return () => clearTimeout(timer);
  }, [idx]);

  // Focus input when phase switches to input
  useEffect(() => {
    if (phase === "input") {
      setTimeout(() => input_ref.current?.focus(), 100);
    }
  }, [phase]);

  // Redirect to session on complete
  useEffect(() => {
    if (is_done) {
      if (from_chat) {
        window.close();
      } else {
        window.location.href = `/sessions/${session_id}/list`;
      }
    }
  }, [is_done, from_chat]);

  function handleCheck() {
    if (!current || !input_val.trim()) return;
    const s = calcScore(current.sentence, input_val);
    set_score(s);
    set_phase("result");
  }

  function handleNext() {
    if (is_last) {
      // Submit result
      result_fetcher.submit(
        { auth_user_id },
        {
          method: "POST",
          action: `/api/v2/dictation/${stage_id}/result`,
          encType: "application/json",
        }
      );
    } else {
      set_idx((i) => i + 1);
      set_phase("listen");
      set_input_val("");
      set_score(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fdf8f0] px-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-[0_8px_40px_rgba(26,39,68,0.10)]">
          <p className="mb-4 text-sm text-[#6b7a99]">
            받아쓰기 문항이 없습니다. 세션에 예문 카드가 있는 학습 스테이지를 추가해주세요.
          </p>
          <Link
            to={`/sessions/${session_id}/list`}
            className="inline-block rounded-2xl bg-[#1a2744] px-6 py-3 text-sm font-extrabold text-white"
          >
            세션으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const diff = phase === "result" && current
    ? diffChars(current.sentence, input_val)
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#fdf8f0]">
      {/* Header */}
      <div className="border-b border-[#e8ecf5] bg-white px-6 py-4">
        <div className="mx-auto max-w-md">
          <p className="text-xs font-bold uppercase tracking-wider text-[#4caf72]">
            받아쓰기
          </p>
          <h1 className="font-display text-lg font-black text-[#1a2744]">
            {stage_title}
          </h1>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#e8ecf5]">
            <div
              className="h-full rounded-full bg-[#4caf72] transition-all duration-300"
              style={{ width: `${((idx + (phase === "result" ? 1 : 0)) / items.length) * 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-[#6b7a99]">
            {idx + 1} / {items.length}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-md space-y-5">

          {current && (
            <>
              {/* Word hint */}
              <div className="rounded-2xl bg-white px-5 py-3 text-center shadow-sm">
                <p className="text-xs text-[#6b7a99]">단어</p>
                <p className="font-display text-xl font-black text-[#1a2744]">
                  {current.word}
                </p>
              </div>

              {/* TTS replay button */}
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    playTts(current.sentence, current.tts_lang);
                    set_play_count((c) => c + 1);
                  }}
                  className="flex items-center gap-2 rounded-2xl bg-[#1a2744] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#2a3a5c]"
                >
                  🔊 다시 듣기
                  {play_count > 1 && (
                    <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
                      ×{play_count}
                    </span>
                  )}
                </button>
              </div>

              {/* Input area */}
              {phase !== "listen" && (
                <div className="space-y-3">
                  <input
                    ref={input_ref}
                    type="text"
                    value={input_val}
                    onChange={(e) => set_input_val(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && phase === "input") handleCheck();
                    }}
                    disabled={phase === "result"}
                    placeholder="들은 내용을 입력하세요…"
                    className="w-full rounded-2xl border border-[#1a2744]/10 bg-white px-4 py-3 text-sm text-[#1a2744] placeholder:text-[#b0b8cc] focus:border-[#4caf72] focus:outline-none focus:ring-2 focus:ring-[#4caf72]/20 disabled:opacity-70"
                  />

                  {phase === "input" && (
                    <button
                      onClick={handleCheck}
                      disabled={!input_val.trim()}
                      className="w-full rounded-2xl bg-[#4caf72] py-3.5 text-sm font-extrabold text-white transition hover:bg-[#5ecb87] disabled:opacity-50"
                    >
                      확인 →
                    </button>
                  )}
                </div>
              )}

              {/* Result */}
              {phase === "result" && diff && (
                <div className="space-y-4">
                  {/* Score */}
                  <div className={[
                    "rounded-2xl px-5 py-4 text-center",
                    (score ?? 0) >= 80
                      ? "bg-[#4caf72]/10 border border-[#4caf72]/20"
                      : "bg-red-50 border border-red-100",
                  ].join(" ")}>
                    <p className={[
                      "text-2xl font-black font-display",
                      (score ?? 0) >= 80 ? "text-[#4caf72]" : "text-red-500",
                    ].join(" ")}>
                      {score}점
                    </p>
                    <p className="mt-0.5 text-xs text-[#6b7a99]">
                      {(score ?? 0) >= 80 ? "잘하셨어요! 👏" : "조금 더 연습해봐요 💪"}
                    </p>
                  </div>

                  {/* Diff highlight */}
                  <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
                    <p className="mb-2 text-xs font-bold text-[#6b7a99]">정답</p>
                    <p className="text-sm leading-relaxed">
                      {diff.map((d, i) => (
                        <span
                          key={i}
                          className={d.correct ? "text-[#1a2744]" : "bg-red-100 text-red-600"}
                        >
                          {d.char}
                        </span>
                      ))}
                    </p>
                    {/* Translation */}
                    <p className="mt-3 text-xs text-[#6b7a99]">
                      {current.translation}
                    </p>
                  </div>

                  {/* Next button */}
                  <button
                    onClick={handleNext}
                    disabled={result_fetcher.state !== "idle"}
                    className="w-full rounded-2xl bg-[#1a2744] py-3.5 text-sm font-extrabold text-white transition hover:bg-[#2a3a5c] disabled:opacity-60"
                  >
                    {is_last
                      ? result_fetcher.state !== "idle"
                        ? "완료 처리 중..."
                        : "완료 ✓"
                      : "다음 →"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
