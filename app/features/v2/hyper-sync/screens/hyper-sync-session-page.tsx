/**
 * /hyper-sync/session — mission play screen.
 *
 * Query params:
 *   productId, sessionId
 *
 * Anonymous access allowed. Login state is read in the loader and passed to
 * the client so the result screen can decide which CTA to show.
 *
 * State machine phases:
 *   loading  — initial card render
 *   front    — front face shown (2s auto-dwell)
 *   back     — back face + verdict buttons (3s auto-unknown)
 *   flash    — 0.4s green/red flash before next card
 *   result   — final summary screen (inline)
 *
 * Retry queue is FIFO; an entry is { stage, step: 1..5 }. Retry cards are
 * displayed before any new card. Wrong answers in retry advance step;
 * correct answers eject the entry from the queue (skipping remaining steps).
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
} from "react-router";
import type { LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import {
  getHyperSyncCards,
  getHyperSyncProduct,
  getNextHyperSyncMission,
} from "../lib/queries.server";
import {
  getRetryCard,
  localSessionDate,
  type CardEntry,
  type RetryStep,
} from "../lib/session-logic";
import { HyperSyncHeader } from "../components/hyper-sync-header";

const FRONT_DWELL_MS = 2000;
const BACK_TIMER_SEC = 3;
const FLASH_MS = 400;

const PRODUCT_SLUG = "developer-english";

// ---------------------------------------------------------------------------
// Loader — fetch cards, shuffle on server, detect login
// ---------------------------------------------------------------------------

function fisherYates<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const sessionId = url.searchParams.get("sessionId");
  if (!productId || !sessionId) throw redirect("/hyper-sync");

  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();

  const product = await getHyperSyncProduct(client as any, PRODUCT_SLUG);
  if (!product || product.id !== productId) throw redirect("/hyper-sync");

  const cardsRaw = await getHyperSyncCards(client as any, sessionId);
  if (cardsRaw.length === 0) throw redirect("/hyper-sync");

  // Need session_number for the [next mission] action on result screen.
  const { data: sessionRow } = await client
    .from("nv2_product_sessions")
    .select("session_number, title")
    .eq("id", sessionId)
    .maybeSingle();

  const nextMission =
    sessionRow != null
      ? await getNextHyperSyncMission(
          client as any,
          product.id,
          sessionRow.session_number
        )
      : null;

  return {
    cards: fisherYates(cardsRaw),
    productId: product.id,
    productSlug: product.slug,
    sessionId,
    sessionTitle: sessionRow?.title ?? null,
    nextMissionId: nextMission?.id ?? null,
    isAuthenticated: !!user,
  };
}

/**
 * Skip loader revalidation when the URL hasn't changed (e.g. fetcher submits
 * during play). The loader shuffles cards via fisherYates(); re-running it
 * after every save-result fetcher would re-shuffle mid-session and surface
 * the wrong "next" card briefly before the retry queue update lands.
 *
 * For real navigation (e.g. clicking "다음 미션" to a different sessionId),
 * the URL changes so the loader DOES re-run — otherwise the page would
 * silently keep showing the old mission's data.
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
// TTS — module-level generation counter (same pattern as marathon-page)
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
  // Bail on stale callbacks if a newer card has fired stopTts.
  utt.onend = () => {
    if (_tts_gen !== my_gen) return;
  };
  window.speechSynthesis.speak(utt);
}

// ---------------------------------------------------------------------------
// Anonymous identity
// ---------------------------------------------------------------------------

const ANON_KEY = "nudge_anon_id";

function getOrCreateAnonId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(ANON_KEY);
  if (!id) {
    id = `anon:${crypto.randomUUID()}`;
    window.localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Phase = "front" | "back" | "flash" | "result";

interface RetryEntry {
  stage: CardEntry;
  step: RetryStep;
}

interface ResultRow {
  stage: CardEntry;
  known: boolean;
}

export default function HyperSyncSessionPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const saveFetcher = useFetcher();
  const enqueueFetcher = useFetcher();

  const cards = data.cards;
  const totalCards = cards.length;

  const [authUserId, setAuthUserId] = useState<string>("");
  const [idx, setIdx] = useState(0);
  const [retryQueue, setRetryQueue] = useState<RetryEntry[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [phase, setPhase] = useState<Phase>("front");
  const [flashKind, setFlashKind] = useState<"known" | "unknown" | null>(null);
  const [timerTenths, setTimerTenths] = useState(BACK_TIMER_SEC * 10);
  const [sessionStart, setSessionStart] = useState<number>(0);
  const [enqueueAttempted, setEnqueueAttempted] = useState(false);

  const isRetry = retryQueue.length > 0;
  const isDone = !isRetry && idx >= totalCards;

  // Anonymous id is stable across sessions on the same device.
  useEffect(() => {
    setAuthUserId(getOrCreateAnonId());
  }, []);

  // Reset all per-session state when the loader hands us a different mission
  // (e.g. user clicked "다음 미션" on the result screen). Without this, the
  // component instance is reused with phase=result, idx=N, etc. — leaving the
  // user stuck on the previous mission's completed view.
  useEffect(() => {
    setIdx(0);
    setRetryQueue([]);
    setResults([]);
    setPhase("front");
    setFlashKind(null);
    setTimerTenths(BACK_TIMER_SEC * 10);
    setSessionStart(Date.now());
    setEnqueueAttempted(false);
  }, [data.sessionId]);

  // Compute the currently displayed card view.
  const currentView = useMemo(() => {
    if (isRetry) {
      const entry = retryQueue[0];
      return {
        kind: "retry" as const,
        step: entry.step,
        stage: entry.stage,
        view: getRetryCard(entry.stage, entry.step),
      };
    }
    if (idx < totalCards) {
      const stage = cards[idx];
      return {
        kind: "normal" as const,
        step: null as null,
        stage,
        view: {
          card: { front: stage.titleCard.front, back: stage.titleCard.back },
          isFlipped: false,
          isExample: false,
        },
      };
    }
    return null;
  }, [cards, idx, retryQueue, totalCards, isRetry]);

  // ─── TTS auto-play on front entry ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== "front" || !currentView) return;
    const lang = currentView.view.isFlipped
      ? "ko-KR"
      : "en-US"; // developer-english only — target_locale is always 'en'
    playTtsOnce(currentView.view.card.front, lang);
  }, [phase, currentView]);

  // ─── Auto-advance front → back after 2s ───────────────────────────────────
  useEffect(() => {
    if (phase !== "front") return;
    const t = setTimeout(() => setPhase("back"), FRONT_DWELL_MS);
    return () => clearTimeout(t);
  }, [phase, currentView]);

  // ─── Back-face timer (3s → auto unknown) ──────────────────────────────────
  useEffect(() => {
    if (phase !== "back") return;
    setTimerTenths(BACK_TIMER_SEC * 10);
    let remaining = BACK_TIMER_SEC * 10; // tenths
    const iv = setInterval(() => {
      remaining--;
      setTimerTenths(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(iv);
        handleVerdict(false);
      }
    }, 100);
    return () => clearInterval(iv);
    // handleVerdict is recreated each render but tied to currentView/phase via closure;
    // we intentionally restart the timer only when phase changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentView]);

  // ─── Result phase — fire enqueue-review once ──────────────────────────────
  useEffect(() => {
    if (!isDone || enqueueAttempted || !data.isAuthenticated) return;
    if (results.length === 0) {
      setEnqueueAttempted(true);
      return;
    }
    setEnqueueAttempted(true);
    // Send ALL verdicts (known + unknown) so the server can apply SRS state
    // transitions: known → r2_pending (+3d), unknown → r1_pending (+1d), etc.
    enqueueFetcher.submit(
      {
        product_slug: data.productSlug,
        source_session_id: data.sessionId,
        outcomes: results.map((r) => ({
          stage_id: r.stage.stageId,
          card_id: r.stage.titleCard.id,
          verdict: r.known ? "known" : "unknown",
        })),
      } as Record<string, any>,
      {
        method: "post",
        action: "/api/v2/hyper-sync/enqueue-review",
        encType: "application/json",
      }
    );
  }, [
    isDone,
    enqueueAttempted,
    data.isAuthenticated,
    data.productSlug,
    data.sessionId,
    results,
    enqueueFetcher,
  ]);

  useEffect(() => {
    if (isDone && phase !== "result") setPhase("result");
  }, [isDone, phase]);

  // ─── Verdict handler ──────────────────────────────────────────────────────
  const handleVerdict = useCallback(
    (known: boolean) => {
      if (phase !== "back" || !currentView) return;
      stopTts();
      setFlashKind(known ? "known" : "unknown");
      setPhase("flash");

      const wasRetry = currentView.kind === "retry";
      const stage = currentView.stage;

      // Persist result for normal cards only (retry results are not aggregated).
      if (!wasRetry && authUserId) {
        const body = {
          auth_user_id: authUserId,
          product_id: data.productId,
          session_id: data.sessionId,
          card_id: stage.titleCard.id,
          result: known ? "known" : "unknown",
          session_date: localSessionDate(
            Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul"
          ),
        };
        saveFetcher.submit(body as Record<string, any>, {
          method: "post",
          action: "/api/v2/hyper-sync/save-result",
          encType: "application/json",
        });
      }

      // After flash, transition state.
      setTimeout(() => {
        setFlashKind(null);
        if (wasRetry) {
          setRetryQueue((q) => {
            const head = q[0];
            if (!head) return q;
            if (known) return q.slice(1);
            const nextStep = (head.step + 1) as RetryStep | 6;
            if (nextStep > 5) return q.slice(1);
            return [{ stage: head.stage, step: nextStep as RetryStep }, ...q.slice(1)];
          });
        } else {
          setResults((r) => [...r, { stage, known }]);
          if (!known) {
            setRetryQueue((q) => [...q, { stage, step: 1 }]);
          }
          setIdx((i) => i + 1);
        }
        setPhase("front");
      }, FLASH_MS);
    },
    [authUserId, currentView, data.productId, data.sessionId, phase, saveFetcher]
  );

  // ─── Result screen rendering ──────────────────────────────────────────────
  if (phase === "result") {
    return (
      <ResultScreen
        results={results}
        sessionStart={sessionStart}
        isAuthenticated={data.isAuthenticated}
        enqueueState={enqueueFetcher.state}
        enqueueData={enqueueFetcher.data}
        nextMissionId={data.nextMissionId}
        productId={data.productId}
        onNextMission={() => {
          if (data.nextMissionId) {
            navigate(
              `/hyper-sync/session?productId=${data.productId}&sessionId=${data.nextMissionId}`
            );
          } else {
            navigate("/hyper-sync");
          }
        }}
        onHome={() => navigate("/hyper-sync")}
      />
    );
  }

  // ─── Playing — front/back/flash ───────────────────────────────────────────
  if (!currentView) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white/60 flex items-center justify-center">
        <p>로딩…</p>
      </div>
    );
  }

  const progressPct = (idx / totalCards) * 100;
  const progressText = isRetry
    ? `복습 ${currentView.step}/5 · ${
        currentView.view.isExample
          ? "예문"
          : currentView.view.isFlipped
          ? "역방향"
          : "단어"
      }`
    : `${idx + 1} / ${totalCards}`;

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
          <Card
            front={currentView.view.card.front}
            back={currentView.view.card.back}
            showBack={phase === "back" || phase === "flash"}
            flash={flashKind}
            isFlipped={currentView.view.isFlipped}
            isExample={currentView.view.isExample}
            retryBadge={
              isRetry ? `STEP ${currentView.step}/5` : null
            }
          />
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
// TimerRing — circular progress ring rendered above the card
// ---------------------------------------------------------------------------

const RING_RADIUS = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 88

function TimerRing({ tenths, total }: { tenths: number; total: number }) {
  const progress = total > 0 ? tenths / total : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);
  const isDanger = tenths <= 10;

  return (
    <div className="absolute -top-11 right-0 h-9 w-9">
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        className="-rotate-90"
      >
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

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function Card({
  front,
  back,
  showBack,
  flash,
  isFlipped,
  isExample,
  retryBadge,
}: {
  front: string;
  back: string;
  showBack: boolean;
  flash: "known" | "unknown" | null;
  isFlipped: boolean;
  isExample: boolean;
  retryBadge: string | null;
}) {
  return (
    <div
      className={
        "flex min-h-[230px] flex-col items-center justify-center gap-5 rounded-2xl border border-white/10 bg-[#111111] px-10 py-12 text-center transition " +
        (flash === "known"
          ? "border-[#c8f564] bg-[#c8f564]/10"
          : flash === "unknown"
          ? "border-[#ff5f5f] bg-[#ff5f5f]/10"
          : "")
      }
    >
      {retryBadge && (
        <span className="rounded border border-white/20 px-2 py-0.5 font-mono text-[10px] tracking-wider text-white/40">
          {retryBadge}
        </span>
      )}
      <div
        className={
          isExample
            ? "text-[17px] font-normal leading-relaxed"
            : isFlipped
            ? "text-[22px] font-medium"
            : "font-mono text-[28px] font-bold tracking-wide"
        }
      >
        {front}
      </div>
      {showBack && (
        <>
          <div className="h-px w-8 bg-white/15" />
          <div
            className={
              "text-white/60 " +
              (isExample
                ? "text-[15px] leading-relaxed"
                : "text-[20px] font-normal")
            }
          >
            {back}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result screen
// ---------------------------------------------------------------------------

function ResultScreen({
  results,
  sessionStart,
  isAuthenticated,
  enqueueState,
  enqueueData,
  nextMissionId,
  productId,
  onNextMission,
  onHome,
}: {
  results: ResultRow[];
  sessionStart: number;
  isAuthenticated: boolean;
  enqueueState: "idle" | "submitting" | "loading";
  enqueueData: any;
  nextMissionId: string | null;
  productId: string;
  onNextMission: () => void;
  onHome: () => void;
}) {
  const known = results.filter((r) => r.known);
  const unknown = results.filter((r) => !r.known);
  const elapsedSec = Math.floor((Date.now() - sessionStart) / 1000);
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0f0f0]">
      <HyperSyncHeader subtitle="hyper-sync" isAuthenticated={isAuthenticated} />
      <main className="mx-auto w-full max-w-[680px] px-7 py-12">
        <div className="mb-8 text-center">
          <div className="mb-3 text-4xl">🎉</div>
          <h2 className="mb-1 font-mono text-2xl">3분 컷 완료!</h2>
          <p className="text-sm text-white/60">소요 시간 {mm}:{ss}</p>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-3">
          <StatCard label="전체" value={results.length} />
          <StatCard label="기억함" value={known.length} tone="known" />
          <StatCard label="기억못함" value={unknown.length} tone="unknown" />
        </div>

        {unknown.length > 0 && (
          <div className="mb-8">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-widest text-white/30">
              기억못함 목록
            </div>
            <ul className="flex flex-col gap-1.5">
              {unknown.map((r) => (
                <li
                  key={r.stage.titleCard.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#111111] px-4 py-2.5"
                >
                  <span className="font-mono text-[13px]">
                    {r.stage.titleCard.front}
                  </span>
                  <span className="text-[13px] text-white/60">
                    {r.stage.titleCard.back}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DiscordCta
          isAuthenticated={isAuthenticated}
          unknownCount={unknown.length}
          enqueueState={enqueueState}
          enqueueData={enqueueData}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onHome}
            className="flex-1 rounded-lg border border-white/15 bg-transparent py-3.5 font-mono text-xs text-white/60 transition hover:border-white/40 hover:text-white"
          >
            ← 처음으로
          </button>
          <button
            type="button"
            onClick={onNextMission}
            className="flex-1 rounded-lg bg-[#c8f564] py-3.5 font-mono text-xs font-bold text-[#0a0a0a] transition hover:opacity-90"
          >
            {nextMissionId ? "다음 미션 →" : "처음으로 ←"}
          </button>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "known" | "unknown";
}) {
  const color =
    tone === "known"
      ? "text-[#c8f564]"
      : tone === "unknown"
      ? "text-[#ff5f5f]"
      : "";
  return (
    <div className="rounded-lg border border-white/10 bg-[#111111] px-4 py-4 text-center">
      <div className="mb-1.5 text-[11px] tracking-wider text-white/60">{label}</div>
      <div className={"font-mono text-2xl font-bold " + color}>{value}</div>
    </div>
  );
}

function DiscordCta({
  isAuthenticated,
  unknownCount,
  enqueueState,
  enqueueData,
}: {
  isAuthenticated: boolean;
  unknownCount: number;
  enqueueState: "idle" | "submitting" | "loading";
  enqueueData: any;
}) {
  if (!isAuthenticated) {
    return (
      <div className="mb-7 rounded-xl border border-white/15 bg-[#1a1a1a] px-6 py-5">
        <div className="mb-1.5 text-sm font-medium">
          내일 아침 Discord로 복습 받을까요?
        </div>
        <div className="mb-3.5 text-xs leading-relaxed text-white/60">
          로그인하면 기억못함 표현을 자동으로 복습 예약합니다.
        </div>
        <a
          href="/login?next=/hyper-sync"
          className="inline-block rounded-lg bg-[#5865F2] px-5 py-2.5 font-mono text-xs font-bold text-white transition hover:opacity-90"
        >
          로그인 →
        </a>
      </div>
    );
  }

  if (unknownCount === 0) {
    return (
      <div className="mb-7 rounded-xl border border-[#c8f564]/25 bg-[#c8f564]/10 px-6 py-5 text-sm font-medium text-[#c8f564]">
        ✓ 오늘은 모두 기억했어요. 내일 다시 도전해보세요!
      </div>
    );
  }

  // Authenticated + has unknowns — show enqueue status
  const inFlight = enqueueState !== "idle";
  const ok = enqueueData?.ok === true;
  const skipped = enqueueData?.skipped === true;

  let body: string;
  if (inFlight) body = "복습 예약 중…";
  else if (ok) body = `✓ ${unknownCount}개 표현이 내일 아침 Discord로 예약됐어요.`;
  else if (skipped) body = "이미 예약된 표현입니다. 내일 아침 Discord를 확인하세요.";
  else body = `${unknownCount}개 표현을 내일 아침 Discord로 받을 수 있어요.`;

  return (
    <div className="mb-7 rounded-xl border border-[#c8f564]/25 bg-[#c8f564]/10 px-6 py-5 text-sm font-medium text-[#c8f564]">
      {body}
    </div>
  );
}
