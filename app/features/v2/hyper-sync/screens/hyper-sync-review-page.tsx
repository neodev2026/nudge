/**
 * /hyper-sync/review/:scheduleId — Discord DM landing for review.
 *
 * The schedule row in nv2_schedules holds the card_ids in message_body.
 * Each card is replayed through the 5-step retry pattern (steps 1→5),
 * exactly like a card that was marked "기억못함" in a normal session.
 *
 * Owner verification is enforced server-side via RLS-equivalent check in
 * getHyperSyncReviewSchedule. Anonymous visitors get redirected to login.
 *
 * Phase 1: review results are NOT persisted and do NOT enqueue follow-up
 * reviews. SRS box_level is a future enhancement (spec §6.6).
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { redirect, useFetcher, useLoaderData, useNavigate } from "react-router";
import type { LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  getHyperSyncCardsByIds,
  getHyperSyncReviewSchedule,
  markHyperSyncReviewOpened,
} from "../lib/queries.server";
import { parseHyperSyncMessageBody } from "../lib/message-body";
import {
  getRetryCard,
  type CardEntry,
  type RetryStep,
} from "../lib/session-logic";
import { HyperSyncHeader } from "../components/hyper-sync-header";

const FRONT_DWELL_MS = 2000;
const BACK_TIMER_SEC = 3;
const FLASH_MS = 400;

export async function loader({ request, params }: LoaderFunctionArgs) {
  const scheduleIdRaw = params.scheduleId;
  if (!scheduleIdRaw) throw redirect("/hyper-sync");
  // Reject non-numeric — schedule_id is bigserial.
  if (!/^\d+$/.test(scheduleIdRaw)) throw redirect("/hyper-sync");

  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw redirect(
      `/login?next=${encodeURIComponent(`/hyper-sync/review/${scheduleIdRaw}`)}`
    );
  }

  const admin = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const schedule = await getHyperSyncReviewSchedule(
    admin as any,
    scheduleIdRaw,
    user.id
  );

  if (!schedule) throw redirect("/hyper-sync");

  const parsed = parseHyperSyncMessageBody(schedule.message_body);
  if (!parsed || parsed.cardIds.length === 0) throw redirect("/hyper-sync");

  const cards = await getHyperSyncCardsByIds(admin as any, parsed.cardIds);
  if (cards.length === 0) throw redirect("/hyper-sync");

  // Stamp opened_at (idempotent).
  await markHyperSyncReviewOpened(admin as any, scheduleIdRaw).catch(() => {});

  return {
    cards,
    scheduleId: scheduleIdRaw,
    totalUnknown: parsed.totalUnknown,
    productSlug: parsed.productSlug,
    sourceSessionId: parsed.sourceSessionId,
  };
}

/**
 * Skip revalidation when the URL hasn't changed — opened_at is stamped once
 * on entry and the card list is fixed per schedule. For real navigation
 * (different scheduleId), let the loader run normally so the new review
 * loads.
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => {
  if (currentUrl.toString() !== nextUrl.toString()) {
    return defaultShouldRevalidate;
  }
  return false;
};

// ---------------------------------------------------------------------------
// TTS — same pattern as session page
// ---------------------------------------------------------------------------

let _tts_gen = 0;
function stopTts() {
  _tts_gen++;
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
function playTtsOnce(text: string, lang: string) {
  stopTts();
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const my_gen = _tts_gen;
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang;
  utt.rate = 0.9;
  utt.onerror = () => {};
  utt.onend = () => {
    if (_tts_gen !== my_gen) return;
  };
  window.speechSynthesis.speak(utt);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Phase = "front" | "back" | "flash" | "result";

interface RetryEntry {
  stage: CardEntry;
  step: RetryStep;
}

export default function HyperSyncReviewPage() {
  const data = useLoaderData<typeof loader>();
  const cards = data.cards;
  const navigate = useNavigate();
  const outcomeFetcher = useFetcher();

  const initialQueue = useMemo<RetryEntry[]>(
    () => cards.map((c) => ({ stage: c, step: 1 as RetryStep })),
    [cards]
  );

  const [queue, setQueue] = useState<RetryEntry[]>(initialQueue);
  const [phase, setPhase] = useState<Phase>("front");
  const [flashKind, setFlashKind] = useState<"known" | "unknown" | null>(null);
  const [timerTenths, setTimerTenths] = useState(BACK_TIMER_SEC * 10);
  const [completed, setCompleted] = useState(0);
  // Per-stage verdict — true = passed (step 1 [기억함] only, per SRS-1).
  const [verdicts, setVerdicts] = useState<Map<string, boolean>>(new Map());
  const [outcomePosted, setOutcomePosted] = useState(false);
  const total = cards.length;

  const current = queue[0] ?? null;
  const view = current ? getRetryCard(current.stage, current.step) : null;

  // ─── TTS on front entry ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "front" || !view) return;
    const lang = view.isFlipped ? "ko-KR" : "en-US";
    playTtsOnce(view.card.front, lang);
  }, [phase, view]);

  // ─── front → back auto-advance ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "front" || !current) return;
    const t = setTimeout(() => setPhase("back"), FRONT_DWELL_MS);
    return () => clearTimeout(t);
  }, [phase, current]);

  // ─── back timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "back") return;
    setTimerTenths(BACK_TIMER_SEC * 10);
    let remaining = BACK_TIMER_SEC * 10;
    const iv = setInterval(() => {
      remaining--;
      setTimerTenths(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(iv);
        handleVerdict(false);
      }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current]);

  // ─── result transition ────────────────────────────────────────────────────
  useEffect(() => {
    if (queue.length === 0 && phase !== "result") {
      setPhase("result");
    }
  }, [queue.length, phase]);

  // ─── post review outcomes to SRS engine once on completion ────────────────
  useEffect(() => {
    if (phase !== "result" || outcomePosted) return;
    if (verdicts.size === 0) {
      setOutcomePosted(true);
      return;
    }
    const outcomes: { stage_id: string; card_id: string; passed: boolean }[] = [];
    for (const c of cards) {
      const passed = verdicts.get(c.stageId);
      if (passed === undefined) continue;
      outcomes.push({
        stage_id: c.stageId,
        card_id: c.titleCard.id,
        passed,
      });
    }
    setOutcomePosted(true);
    if (outcomes.length === 0) return;
    outcomeFetcher.submit(
      {
        product_slug: data.productSlug,
        source_session_id: data.sourceSessionId,
        outcomes,
      } as Record<string, any>,
      {
        method: "post",
        action: "/api/v2/hyper-sync/record-review-outcome",
        encType: "application/json",
      }
    );
  }, [
    phase,
    outcomePosted,
    verdicts,
    cards,
    data.productSlug,
    data.sourceSessionId,
    outcomeFetcher,
  ]);

  const handleVerdict = useCallback(
    (known: boolean) => {
      if (phase !== "back" || !current) return;
      stopTts();
      setFlashKind(known ? "known" : "unknown");
      setPhase("flash");

      setTimeout(() => {
        setFlashKind(null);
        setQueue((q) => {
          const head = q[0];
          if (!head) return q;
          const stageId = head.stage.stageId;

          // Decide drop vs advance, and the SRS verdict on drop.
          // SRS-1 strict: pass = first-attempt [기억함] only.
          const isKnownAtStep1 = known && head.step === 1;
          const exhausted = !known && head.step === 5;
          const willDrop = known || exhausted;

          if (willDrop) {
            const passed = isKnownAtStep1;
            setVerdicts((prev) => {
              const next = new Map(prev);
              next.set(stageId, passed);
              return next;
            });
            setCompleted((c) => c + 1);
            return q.slice(1);
          }

          // [기억못함] at step 1~4 → advance step.
          return [
            { stage: head.stage, step: (head.step + 1) as RetryStep },
            ...q.slice(1),
          ];
        });
        setPhase("front");
      }, FLASH_MS);
    },
    [current, phase]
  );

  if (phase === "result") {
    const summary = outcomeFetcher.data?.summary as
      | {
          promoted: number;
          mastered: number;
          refreshed: number;
        }
      | undefined;
    const inFlight = outcomeFetcher.state !== "idle";
    const passedCount = Array.from(verdicts.values()).filter((v) => v).length;
    const failedCount = total - passedCount;

    return (
      <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0]">
        <HyperSyncHeader subtitle="hyper-sync / review" isAuthenticated={true} />
        <main className="mx-auto w-full max-w-[680px] px-7 py-16 text-center">
          <div className="mb-3 text-4xl">🔁</div>
          <h2 className="mb-2 font-mono text-2xl">복습 완료!</h2>
          <p className="mb-8 text-sm text-white/60">
            {total}개 표현을 다시 점검했습니다
          </p>

          <div className="mb-8 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-lg border border-white/10 bg-[#111111] px-4 py-3">
              <div className="mb-1 font-mono text-[11px] tracking-wider text-white/40">
                떠올린 표현
              </div>
              <div className="font-mono text-2xl font-bold text-[#c8f564]">
                {passedCount}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#111111] px-4 py-3">
              <div className="mb-1 font-mono text-[11px] tracking-wider text-white/40">
                다시 학습 필요
              </div>
              <div className="font-mono text-2xl font-bold text-[#ff5f5f]">
                {failedCount}
              </div>
            </div>
          </div>

          {inFlight ? (
            <p className="mb-8 text-xs text-white/40">복습 일정 갱신 중…</p>
          ) : summary ? (
            <div className="mb-8 rounded-xl border border-[#c8f564]/25 bg-[#c8f564]/10 px-5 py-4 text-left text-xs leading-relaxed text-[#c8f564]">
              {summary.mastered > 0 && (
                <div>✓ {summary.mastered}개 표현이 마스터됐어요!</div>
              )}
              {summary.promoted > 0 && (
                <div>↑ {summary.promoted}개 표현이 다음 단계로 이동</div>
              )}
              {summary.refreshed > 0 && (
                <div>↻ {summary.refreshed}개 표현은 내일 다시 보내드릴게요</div>
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => navigate("/hyper-sync")}
            className="rounded-lg bg-[#c8f564] px-6 py-3 font-mono text-xs font-bold text-[#0a0a0a] transition hover:opacity-90"
          >
            처음으로 →
          </button>
        </main>
      </div>
    );
  }

  if (!view || !current) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white/60 flex items-center justify-center">
        <p>로딩…</p>
      </div>
    );
  }

  const progressPct = (completed / total) * 100;
  const progressText = `복습 ${current.step}/5 · ${
    view.isExample ? "예문" : view.isFlipped ? "역방향" : "단어"
  }`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0] flex flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-7 py-5">
        <div className="h-[2px] flex-1 overflow-hidden rounded bg-[#1a1a1a]">
          <div
            className="h-full rounded bg-[#c8f564] transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="whitespace-nowrap font-mono text-xs text-white/60">
          {progressText}
        </span>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center px-7 py-10">
        <div className="relative w-full max-w-[520px]">
          {phase === "back" && (
            <TimerRing tenths={timerTenths} total={BACK_TIMER_SEC * 10} />
          )}
          <div
            className={
              "flex min-h-[230px] flex-col items-center justify-center gap-5 rounded-2xl border border-white/10 bg-[#111111] px-10 py-12 text-center transition " +
              (flashKind === "known"
                ? "border-[#c8f564] bg-[#c8f564]/10"
                : flashKind === "unknown"
                ? "border-[#ff5f5f] bg-[#ff5f5f]/10"
                : "")
            }
          >
            <span className="rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] tracking-wider text-white/40">
              STEP {current.step}/5
            </span>
            <div
              className={
                view.isExample
                  ? "text-[17px] font-normal leading-relaxed"
                  : view.isFlipped
                  ? "text-[22px] font-medium"
                  : "font-mono text-[28px] font-bold tracking-wide"
              }
            >
              {view.card.front}
            </div>
            {(phase === "back" || phase === "flash") && (
              <>
                <div className="h-px w-8 bg-white/15" />
                <div
                  className={
                    "text-white/60 " +
                    (view.isExample
                      ? "text-[15px] leading-relaxed"
                      : "text-[20px] font-normal")
                  }
                >
                  {view.card.back}
                </div>
              </>
            )}
          </div>
        </div>

        <div
          className={
            "mt-6 flex w-full max-w-[520px] gap-3 transition " +
            (phase === "back" ? "opacity-100" : "pointer-events-none opacity-0")
          }
        >
          <button
            type="button"
            onClick={() => handleVerdict(false)}
            className="flex-1 rounded-lg border border-[#ff5f5f] bg-[#ff5f5f]/10 py-3.5 font-mono text-xs font-bold tracking-wider text-[#ff5f5f] transition hover:bg-[#ff5f5f]/20"
          >
            기억못함
          </button>
          <button
            type="button"
            onClick={() => handleVerdict(true)}
            className="flex-1 rounded-lg border border-[#c8f564] bg-[#c8f564]/10 py-3.5 font-mono text-xs font-bold tracking-wider text-[#c8f564] transition hover:bg-[#c8f564]/20"
          >
            기억함
          </button>
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimerRing — circular progress ring shown during the back-face countdown.
// ---------------------------------------------------------------------------

const RING_RADIUS = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function TimerRing({ tenths, total }: { tenths: number; total: number }) {
  const progress = total > 0 ? tenths / total : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  const isDanger = tenths <= 10;

  return (
    <div className="absolute -top-11 right-0 h-9 w-9">
      <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
        <circle
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          stroke="#1a1a1a"
          strokeWidth="3"
        />
        <circle
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          stroke={isDanger ? "#ff5f5f" : "#c8f564"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s" }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[11px] text-white/60">
        {Math.ceil(tenths / 10)}
      </div>
    </div>
  );
}
