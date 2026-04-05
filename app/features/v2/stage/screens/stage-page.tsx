/**
 * /stages/:stageId
 *
 * Learning stage page — displays cards in order, then presents self-evaluation.
 *
 * Card flow:
 *   title card → description card → ... → self-evaluation screen
 *   "처음부터 다시 보기" → restart from card 0, retry_count++
 *   "학습 완료"         → POST /api/v2/stage/:stageId/complete → redirect to session
 *
 * TTS:
 *   - title / example 카드에 발음 듣기 버튼 (무한 반복)
 *   - 다음 버튼, 처음부터 다시 보기, 학습 목록 이동 시 자동 중지
 */
import type { Route } from "./+types/stage-page";

import { useLoaderData, useFetcher, Link } from "react-router";
import { useState, useCallback } from "react";
import { redirect } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import { getNv2StageWithCards } from "../lib/queries.server";
import type { V2CardData } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = ({ matches }) => {
  const loader_data = matches.find(
    (m) => m?.id === "routes/stages/:stageId"
  )?.data as Awaited<ReturnType<typeof loader>> | undefined;

  return [
    { title: loader_data ? `${loader_data.stage.title} — Nudge` : "Nudge" },
  ];
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);

  const stage = await getNv2StageWithCards(client, params.stageId);

  if (!stage) {
    throw new Response("Stage not found", { status: 404 });
  }

  const { data: auth_session } = await client.auth.getSession();
  const auth_user = auth_session.session?.user ?? null;
  const is_authenticated = !!auth_user;

  const session_id = new URL(request.url).searchParams.get("session");

  let sns_type: string | null = null;
  let sns_id: string | null = null;
  let link_access: string = "members_only";

  if (session_id) {
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
        const { redirect } = await import("react-router");
        const next = encodeURIComponent(
          `/stages/${params.stageId}?session=${session_id}`
        );
        throw redirect(`/auth/discord/start?next=${next}`);
      }
    }
  } else {
    const meta = auth_user?.user_metadata as
      | Record<string, unknown>
      | undefined;
    sns_id =
      (meta?.provider_id as string | undefined) ??
      (meta?.sub as string | undefined) ??
      null;
    sns_type = auth_user ? "discord" : null;
    link_access = "members_only";
  }

  return {
    stage,
    is_authenticated,
    sns_type,
    sns_id,
    session_id,
    link_access,
  };
}

// ---------------------------------------------------------------------------
// TTS 전역 상태 — 모듈 레벨에서 관리해야 stopTts()가 is_looping을 직접 제어 가능
// ---------------------------------------------------------------------------

let _tts_looping = false;

function stopTts() {
  _tts_looping = false; // 루프 플래그 먼저 해제 → onend 콜백이 재발화 안 함
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StagePage() {
  const { stage, is_authenticated, sns_type, sns_id, session_id, link_access } =
    useLoaderData<typeof loader>();

  const cards = stage.nv2_cards;
  const [card_index, set_card_index] = useState(0);
  const [phase, set_phase] = useState<"cards" | "eval">("cards");

  const complete_fetcher = useFetcher();
  const retry_fetcher = useFetcher();

  const current_card = cards[card_index];
  const is_last_card = card_index === cards.length - 1;
  const can_submit = !!sns_type && !!sns_id;

  function handleNext() {
    stopTts(); // 다음 카드로 넘어갈 때 TTS 중지
    if (is_last_card) {
      set_phase("eval");
    } else {
      set_card_index((i) => i + 1);
    }
  }

  function handleRetry() {
    if (!can_submit) return;
    stopTts(); // 처음부터 다시 볼 때 TTS 중지
    retry_fetcher.submit(
      { sns_type, sns_id },
      {
        method: "POST",
        action: `/api/v2/stage/${stage.id}/retry`,
        encType: "application/json",
      }
    );
    set_card_index(0);
    set_phase("cards");
  }

  function handleComplete() {
    if (!can_submit) return;
    complete_fetcher.submit(
      { sns_type, sns_id },
      {
        method: "POST",
        action: `/api/v2/stage/${stage.id}/complete`,
        encType: "application/json",
      }
    );
  }

  const complete_data = complete_fetcher.data as
    | { ok: boolean; next_stage_id: string | null }
    | undefined;

  if (complete_data?.ok) {
    if (session_id) {
      window.location.href = `/sessions/${session_id}`;
    } else if (complete_data.next_stage_id) {
      window.location.href = `/stages/${complete_data.next_stage_id}`;
    }
  }

  if (cards.length === 0) {
    return <NoCardsState stage_title={stage.title} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#fdf8f0] px-4 py-10">
      {/* Header */}
      <div className="mb-8 w-full max-w-md">
        {/* 학습 목록으로 이동 시 TTS 중지 */}
        <Link
          to={session_id ? `/sessions/${session_id}` : "/products"}
          className="text-xs font-semibold text-[#6b7a99] hover:text-[#1a2744]"
          onClick={stopTts}
        >
          ← 학습 목록
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-lg bg-[#1a2744] px-3 py-1 text-[0.7rem] font-black uppercase tracking-wide text-white">
            Stage {stage.stage_number}
          </span>
          {phase === "cards" && (
            <div className="flex gap-1.5">
              {cards.map((_, i) => (
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
          )}
        </div>
      </div>

      {phase === "cards" ? (
        <CardView
          card={current_card}
          card_index={card_index}
          total={cards.length}
          onNext={handleNext}
        />
      ) : (
        <EvalView
          stage_title={stage.title}
          is_authenticated={is_authenticated}
          can_submit={can_submit}
          link_access={link_access ?? "public"}
          is_completing={complete_fetcher.state !== "idle"}
          complete_done={!!complete_data?.ok}
          next_stage_id={complete_data?.next_stage_id ?? null}
          session_id={session_id}
          onRetry={handleRetry}
          onComplete={handleComplete}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
/** Maps card meta.target_locale to BCP-47 language tag for Web Speech API */
const TTS_LANG_MAP: Record<string, string> = {
  de: "de-DE",
  en: "en-US",
  ja: "ja-JP",
  ko: "ko-KR",
  fr: "fr-FR",
  es: "es-ES",
};

// TTS Hook — 무한 반복, 다시 누르면 중지
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// TTS Button
// ---------------------------------------------------------------------------

function TtsButton({ text, lang = "de-DE" }: { text: string; lang?: string }) {
  const { toggle, active } = useTts(text, lang);
  return (
    <button
      onClick={toggle}
      className={[
        "mt-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all",
        active
          ? "bg-[#4caf72] text-white"
          : "bg-[#fdf8f0] text-[#6b7a99] hover:bg-[#e8ecf5] hover:text-[#1a2744]",
      ].join(" ")}
    >
      <span className="text-base">{active ? "⏹" : "🔊"}</span>
      {active ? "중지" : "발음 듣기"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CardView
// ---------------------------------------------------------------------------

function CardView({
  card,
  card_index,
  total,
  onNext,
}: {
  card: { card_type: string; card_data: unknown };
  card_index: number;
  total: number;
  onNext: () => void; // stopTts() 이미 포함됨 (StagePage.handleNext에서 호출)
}) {
  const data = card.card_data as V2CardData;
  const type = card.card_type;

  // Resolve TTS language from card metadata.
  // Falls back to "de-DE" for legacy cards without target_locale.
  const tts_lang = TTS_LANG_MAP[data.meta?.target_locale ?? "de"] ?? "de-DE";

  return (
    <div className="flex w-full max-w-md flex-col">
      <div className="rounded-3xl bg-white p-8 shadow-[0_8px_40px_rgba(26,39,68,0.10)]">
        {/* Card type badge */}
        <span className="mb-5 inline-block rounded-lg bg-[#fdf8f0] px-3 py-1 text-[0.68rem] font-black uppercase tracking-wide text-[#6b7a99]">
          {CARD_TYPE_LABELS[type] ?? type}
        </span>

        {/* ── title: 단어 + 번역 + TTS ── */}
        {type === "title" && (
          <>
            <div className="mb-1 font-display text-[2.4rem] font-black leading-tight text-[#1a2744]">
              {data.presentation.front}
            </div>
            <div className="text-lg font-bold text-[#4caf72]">
              {data.presentation.back}
            </div>
            <TtsButton text={data.presentation.front} lang={tts_lang} />
          </>
        )}

        {/* ── description: 설명 텍스트 ── */}
        {type === "description" && (
          <div className="rounded-2xl bg-[#fdf8f0] p-5 text-base leading-[1.8] font-bold text-[#1a2744]">
            {data.presentation.back}
          </div>
        )}

        {/* ── example: 예문 + 번역 + TTS ── */}
        {type === "example" && (
          <>
            <p className="mb-3 text-base font-bold leading-[1.8] text-[#1a2744]">
              {data.presentation.front}
            </p>
            <p className="text-sm text-[#6b7a99]">
              {data.presentation.back}
            </p>
            <TtsButton text={data.presentation.front} lang={tts_lang} />
          </>
        )}

        {/* ── etymology: 어원 ── */}
        {type === "etymology" && (
          <div className="rounded-2xl bg-[#fdf8f0] p-5 text-base leading-[1.8] text-[#1a2744]">
            <p>{data.presentation.front}</p>
            {data.presentation.back && (
              <p className="mt-2 text-sm text-[#6b7a99]">
                {data.presentation.back}
              </p>
            )}
          </div>
        )}

        {/* ── image: 연상 이미지 ── */}
        {type === "image" && (
          <div className="overflow-hidden rounded-2xl">
            <img
              src={data.presentation.front}
              alt={data.presentation.back}
              className="w-full object-cover"
            />
            {data.presentation.back && (
              <p className="mt-2 text-sm text-[#6b7a99]">
                {data.presentation.back}
              </p>
            )}
          </div>
        )}

        {/* ── fallback ── */}
        {!["title", "description", "example", "etymology", "image"].includes(type) && (
          <>
            <p className="mb-3 text-base font-bold text-[#1a2744]">
              {data.presentation.front}
            </p>
            {data.presentation.back && (
              <p className="text-sm text-[#6b7a99]">{data.presentation.back}</p>
            )}
          </>
        )}

        {data.details.explanation && (
          <p className="mt-5 text-sm leading-[1.7] text-[#6b7a99]">
            {data.details.explanation}
          </p>
        )}
      </div>

      {/* Next button */}
      <button
        onClick={onNext}
        className="mt-5 w-full rounded-2xl bg-[#1a2744] py-4 text-base font-extrabold text-white transition-all hover:bg-[#243358] active:scale-[0.98]"
      >
        다음 →
      </button>

      <p className="mt-3 text-center text-xs text-[#6b7a99]">
        {card_index + 1} / {total}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EvalView
// ---------------------------------------------------------------------------

function EvalView({
  stage_title,
  is_authenticated,
  can_submit,
  link_access,
  is_completing,
  complete_done,
  next_stage_id,
  session_id,
  onRetry,
  onComplete,
}: {
  stage_title: string;
  is_authenticated: boolean;
  can_submit: boolean;
  link_access: string;
  is_completing: boolean;
  complete_done: boolean;
  next_stage_id: string | null;
  session_id: string | null;
  onRetry: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="flex w-full max-w-md flex-col items-center text-center">
      <div className="mb-8 w-full rounded-3xl bg-white p-8 shadow-[0_8px_40px_rgba(26,39,68,0.10)]">
        <div className="mb-2 text-4xl">🤔</div>
        <h2 className="mb-2 font-display text-xl font-black text-[#1a2744]">
          "{stage_title}"
        </h2>
        <p className="text-sm text-[#6b7a99]">
          카드를 모두 확인했어요. 기억이 잘 나나요?
        </p>
      </div>

      {!is_authenticated && link_access === "members_only" ? (
        <div className="w-full space-y-3">
          <p className="text-sm text-[#6b7a99]">
            학습 기록을 저장하려면 Discord 로그인이 필요합니다.
          </p>
          <Link
            to="/auth/discord/start"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5865F2] py-4 text-base font-extrabold text-white shadow-[0_4px_16px_rgba(88,101,242,0.30)] transition-all hover:-translate-y-px"
          >
            <DiscordIcon />
            Discord로 로그인하고 기록 저장
          </Link>
          <button
            onClick={onRetry}
            className="w-full rounded-2xl border-2 border-[#e8ecf5] bg-white py-4 text-base font-extrabold text-[#6b7a99] transition-colors hover:border-[#1a2744] hover:text-[#1a2744]"
          >
            ↺ 처음부터 다시 보기
          </button>
        </div>
      ) : complete_done ? (
        <div className="w-full space-y-3">
          <div className="rounded-2xl bg-[#4caf72]/10 px-6 py-5 text-center">
            <div className="mb-1 text-3xl">🎉</div>
            <p className="font-bold text-[#1a2744]">학습 완료!</p>
            <p className="text-sm text-[#6b7a99]">
              {session_id
                ? "세션 페이지로 돌아가는 중..."
                : next_stage_id
                ? "다음 카드로 이동 중..."
                : "모든 단계를 완료했어요!"}
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full space-y-3">
          <button
            onClick={onComplete}
            disabled={is_completing}
            className="w-full rounded-2xl bg-[#4caf72] py-4 text-base font-extrabold text-white transition-all hover:bg-[#5ecb87] disabled:opacity-60 active:scale-[0.98]"
          >
            {is_completing ? "저장 중..." : "학습 완료 ✓"}
          </button>
          <button
            onClick={onRetry}
            disabled={is_completing}
            className="w-full rounded-2xl border-2 border-[#e8ecf5] bg-white py-4 text-base font-extrabold text-[#6b7a99] transition-colors hover:border-[#1a2744] hover:text-[#1a2744] disabled:opacity-60"
          >
            ↺ 처음부터 다시 보기
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NoCardsState
// ---------------------------------------------------------------------------

function NoCardsState({ stage_title }: { stage_title: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 text-5xl">📭</span>
      <h2 className="mb-2 font-display text-xl font-black text-[#1a2744]">
        {stage_title}
      </h2>
      <p className="mb-6 text-sm text-[#6b7a99]">
        아직 카드가 준비되지 않았어요.
      </p>
      <Link
        to="/products"
        className="text-sm font-bold text-[#4caf72] hover:underline"
      >
        ← 상품 목록으로
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CARD_TYPE_LABELS: Record<string, string> = {
  title: "단어",
  description: "설명",
  image: "이미지",
  etymology: "어원",
  example: "예문",
  option: "선택",
};

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.037.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}
