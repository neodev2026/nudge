/**
 * /story/:stageId
 *
 * Story Learning stage page — sentence-by-sentence reveal UX.
 *
 * Flow:
 *   - Text split into sentences. Only the first is shown on entry.
 *   - ▼ bounce hint at the end of the last visible sentence.
 *   - Click anywhere → reveal next sentence.
 *   - Sentence with {{word|meaning}} marker:
 *       · Word shown as blinking green underline.
 *       · Must click word → modal → confirm → next sentence.
 *   - Header (sticky, not scrollable):
 *       · Left: ← 세션 목록
 *       · Center: Ch.N · 제목
 *       · Right: [Auto] [Skip]
 *   - Auto mode: reveals one sentence per 800ms; pauses on marker sentences.
 *   - Skip: reveals everything instantly.
 *   - All revealed → "다음 학습으로 →" button.
 */
import { useLoaderData, useFetcher, Link } from "react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import type { LoaderFunctionArgs } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoryCardData = {
  chapter_number: number;
  chapter_title?: string;
  summary: string;
  hook_text?: string;
  text: string;
  illustration_url: string | null;
};

type WordPopupData = {
  word: string;
  meaning: string;
  pronunciation: string | null;
  example_sentence: string | null;
  example_translation: string | null;
  tts_lang: string;
};

type SentenceWord =
  | { kind: "text"; value: string }
  | { kind: "marker"; word: string; meaning: string };

type Sentence = { parts: SentenceWord[]; has_marker: boolean };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTO_INTERVAL_MS = 1500;

const TTS_LANG_MAP: Record<string, string> = {
  de: "de-DE", en: "en-US", ja: "ja-JP",
  ko: "ko-KR", fr: "fr-FR", es: "es-ES",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\n\n+/g, "\n\n");
  const raw = normalized.split(/(?<=[.!?…"』」])\s+|\n\n/);
  return raw.map(s => s.trim()).filter(s => s.length > 0);
}

function parseSentence(sentence: string): Sentence {
  const parts: SentenceWord[] = [];
  const re = /\{\{([^|]+)\|([^}]+)\}\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let has_marker = false;
  while ((m = re.exec(sentence)) !== null) {
    if (m.index > last) parts.push({ kind: "text", value: sentence.slice(last, m.index) });
    parts.push({ kind: "marker", word: m[1], meaning: m[2] });
    has_marker = true;
    last = m.index + m[0].length;
  }
  if (last < sentence.length) parts.push({ kind: "text", value: sentence.slice(last) });
  return { parts, has_marker };
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: LoaderFunctionArgs) {
  const [client] = makeServerClient(request);
  const { data: { user: auth_user } } = await client.auth.getUser();
  const url        = new URL(request.url);
  const session_id = url.searchParams.get("session");
  const next_url   = url.searchParams.get("next");

  let auth_user_id: string | null = null;

  if (session_id) {
    const { getSessionIdentity } = await import(
      "~/features/v2/session/lib/queries.server"
    );
    const identity = await getSessionIdentity(client, session_id).catch(() => null);
    if (identity) {
      auth_user_id = identity.auth_user_id;
      if (identity.link_access === "members_only" && !auth_user) {
        const { redirect } = await import("react-router");
        const next = encodeURIComponent(`/story/${params.stageId}?session=${session_id}`);
        throw redirect(`/login?next=${next}`);
      }
    }
  } else {
    auth_user_id = auth_user?.id ?? null;
  }

  const { data: stage } = await client
    .from("nv2_stages")
    .select(`
      id, title, stage_type, learning_product_id,
      nv2_cards(id, card_type, card_data, display_order, is_active)
    `)
    .eq("id", params.stageId!)
    .eq("is_active", true)
    .order("display_order", { referencedTable: "nv2_cards", ascending: true })
    .maybeSingle();

  if (!stage) throw new Response("Stage not found", { status: 404 });

  const story_card_raw = (stage.nv2_cards as any[]).find(
    (c) => c.card_type === "story" && c.is_active
  );
  if (!story_card_raw) throw new Response("Story card not found", { status: 404 });

  const story_data = story_card_raw.card_data as StoryCardData;

  let word_map: Record<string, WordPopupData> = {};

  if (session_id) {
    const { data: session_row } = await client
      .from("nv2_sessions")
      .select(`
        product_session_id,
        nv2_product_sessions!inner(
          nv2_product_session_stages(
            nv2_stages!inner(
              id, stage_type, title,
              nv2_cards(id, card_type, card_data, is_active)
            )
          )
        )
      `)
      .eq("session_id", session_id)
      .maybeSingle();

    if (session_row) {
      const links = ((session_row.nv2_product_sessions as any)
        ?.nv2_product_session_stages ?? []) as any[];
      for (const link of links) {
        const st = link.nv2_stages;
        if (!st || st.stage_type !== "learning") continue;
        const cards = (st.nv2_cards ?? []).filter((c: any) => c.is_active);
        const title_card   = cards.find((c: any) => c.card_type === "title");
        const example_card = cards.find((c: any) => c.card_type === "example");
        if (!title_card) continue;
        const td = title_card.card_data as any;
        const ed = example_card?.card_data as any;
        const locale: string = td?.meta?.target_locale ?? "de";
        word_map[st.title] = {
          word:                td?.presentation?.front ?? st.title,
          meaning:             td?.presentation?.back  ?? "",
          pronunciation:       td?.presentation?.hint  ?? null,
          example_sentence:    ed?.presentation?.front ?? null,
          example_translation: ed?.presentation?.back  ?? null,
          tts_lang:            TTS_LANG_MAP[locale] ?? "de-DE",
        };
      }
    }
  }

  const { data: product } = await client
    .from("nv2_learning_products")
    .select("meta")
    .eq("id", stage.learning_product_id)
    .maybeSingle();

  const pm = product?.meta as Record<string, unknown> | null;
  const default_tts_lang =
    TTS_LANG_MAP[typeof pm?.language === "string" ? pm.language : "de"] ?? "de-DE";

  return {
    stage_id: stage.id,
    stage_title: stage.title,
    session_id,
    auth_user_id,
    next_url,
    story: story_data,
    word_map,
    default_tts_lang,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StoryPage() {
  const {
    stage_id, stage_title, session_id, auth_user_id,
    next_url, story, word_map, default_tts_lang,
  } = useLoaderData<typeof loader>();

  const fetcher = useFetcher();

  // Parse once
  const sentences: Sentence[] = splitIntoSentences(story.text).map(parseSentence);
  const total = sentences.length;

  // State
  const [revealed,     set_revealed]     = useState(Math.min(1, total));
  const [all_done,     set_all_done]     = useState(total <= 1);
  const [popup,        set_popup]        = useState<WordPopupData | null>(null);
  const [pending_idx,  set_pending_idx]  = useState<number | null>(null); // waiting for word confirm
  const [confirmed,    set_confirmed]    = useState<Set<string>>(new Set());
  const [auto_mode,    set_auto_mode]    = useState(false);
  const [completed,    set_completed]    = useState(false);

  const auto_ref   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottom_ref = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new sentence appears
  useEffect(() => {
    bottom_ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [revealed]);

  // ── Advance one sentence ──────────────────────────────────────────────────
  const advance = useCallback(() => {
    set_revealed(prev => {
      const next_idx = prev; // 0-based index of next sentence to show
      if (next_idx >= total) {
        set_all_done(true);
        return prev;
      }
      const s = sentences[next_idx];
      if (s.has_marker) {
        // Reveal but pause for word click
        set_pending_idx(next_idx);
      }
      const next_count = prev + 1;
      if (next_count >= total && !s.has_marker) {
        set_all_done(true);
      }
      return next_count;
    });
  }, [total, sentences]);

  // ── Auto mode tick ────────────────────────────────────────────────────────
  useEffect(() => {
    if (auto_ref.current) clearTimeout(auto_ref.current);
    if (!auto_mode || all_done || pending_idx !== null) return;

    auto_ref.current = setTimeout(() => {
      advance();
    }, AUTO_INTERVAL_MS);

    return () => { if (auto_ref.current) clearTimeout(auto_ref.current); };
  }, [auto_mode, all_done, pending_idx, revealed, advance]);

  // ── Skip: reveal up to the next marker sentence (or end if none) ──────────
  const handleSkip = useCallback(() => {
    if (auto_ref.current) clearTimeout(auto_ref.current);
    set_auto_mode(false);
    set_popup(null);

    set_revealed(prev => {
      // Find next marker sentence after current last revealed
      const start = prev; // 0-based index of next sentence
      let target = total; // default: reveal all
      for (let i = start; i < total; i++) {
        if (sentences[i].has_marker) {
          target = i + 1; // reveal up to and including this sentence
          break;
        }
      }
      const next_count = target;
      // If the target sentence has a marker, set pending
      const target_sentence = sentences[target - 1];
      if (target_sentence?.has_marker) {
        set_pending_idx(target - 1);
      } else {
        set_pending_idx(null);
        set_all_done(true);
      }
      if (target >= total && !target_sentence?.has_marker) {
        set_all_done(true);
      }
      return next_count;
    });
  }, [total, sentences]);

  // ── Reset: back to first sentence ──────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (auto_ref.current) clearTimeout(auto_ref.current);
    set_auto_mode(false);
    set_pending_idx(null);
    set_popup(null);
    set_confirmed(new Set());
    set_revealed(Math.min(1, total));
    set_all_done(total <= 1);
    set_completed(false);
  }, [total]);

  // ── Manual click on content area ──────────────────────────────────────────
  const handleContentClick = useCallback(() => {
    // Ignore if popup open or waiting for word click
    if (popup || pending_idx !== null || all_done) return;
    advance();
  }, [popup, pending_idx, all_done, advance]);

  // ── Word click ────────────────────────────────────────────────────────────
  const handleWordClick = useCallback((word: string, meaning: string) => {
    const pd: WordPopupData = word_map[word] ?? {
      word, meaning, pronunciation: null, example_sentence: null,
      example_translation: null, tts_lang: default_tts_lang,
    };
    // Mark word as confirmed immediately on click (stops blinking)
    set_confirmed(prev => new Set([...prev, word]));
    set_popup(pd);
    // Auto-play TTS once when modal opens
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(pd.word);
      u.lang = pd.tts_lang;
      u.rate = 0.9;
      window.speechSynthesis.speak(u);
    }
  }, [word_map, default_tts_lang]);

  // ── Popup confirm ─────────────────────────────────────────────────────────
  const handlePopupConfirm = useCallback(() => {
    // confirmed is already set on word click, nothing extra needed here
    if (popup) set_confirmed(prev => new Set([...prev, popup.word]));
    set_popup(null);
    set_pending_idx(null);
    // After confirming word, advance to next sentence
    set_revealed(prev => {
      const next_idx = prev; // next sentence after current
      if (next_idx >= total) {
        set_all_done(true);
        set_auto_mode(false);
        return prev;
      }
      const s = sentences[next_idx];
      if (s.has_marker) {
        set_pending_idx(next_idx);
      }
      if (prev + 1 >= total && !s.has_marker) {
        set_all_done(true);
      }
      return prev + 1;
    });
  }, [popup, total, sentences]);

  // ── Complete ──────────────────────────────────────────────────────────────
  const handleComplete = useCallback(() => {
    if (completed) return;
    set_completed(true);
    fetcher.submit(
      { auth_user_id: auth_user_id ?? "" },
      { method: "POST", action: `/api/v2/story/${stage_id}/result`, encType: "application/json" }
    );
  }, [completed, fetcher, auth_user_id, stage_id]);

  const after_href = next_url ?? (session_id ? `/sessions/${session_id}/list` : "/my-learning");
  const should_close = next_url === "close";

  useEffect(() => {
    if (fetcher.state === "idle" && completed && fetcher.data) {
      if (should_close) {
        window.close();
      } else {
        window.location.href = after_href;
      }
    }
  }, [fetcher.state, fetcher.data, completed, after_href, should_close]);

  const can_advance = !all_done && pending_idx === null && !popup;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fdf8f0] flex flex-col">

      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-[#1a2744]/[0.07] bg-[#fdf8f0]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-3.5">

          {/* Left: close button when opened from chat, back link otherwise */}
          {should_close ? (
            <button
              onClick={() => window.close()}
              className="shrink-0 text-sm font-semibold text-[#6b7a99] hover:text-[#1a2744]"
            >
              ✕ 닫기
            </button>
          ) : (
            <Link
              to={session_id ? `/sessions/${session_id}/list` : "/my-learning"}
              className="shrink-0 text-sm font-semibold text-[#6b7a99] hover:text-[#1a2744]"
            >
              ← 세션 목록
            </Link>
          )}

          {/* Center */}
          <div className="flex-1 text-center">
            <span className="text-sm font-extrabold text-[#1a2744]">
              Ch.{story.chapter_number}
              {story.chapter_title ? ` · ${story.chapter_title}` : ""}
            </span>
          </div>

          {/* Right: controls */}
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              onClick={() => {
                if (all_done) return;
                set_auto_mode(v => !v);
              }}
              disabled={all_done}
              className={[
                "rounded-full px-3 py-1 text-xs font-bold transition-all",
                auto_mode
                  ? "bg-[#4caf72] text-white shadow-sm"
                  : "bg-[#e8ecf5] text-[#6b7a99] hover:bg-[#d1d5db]",
                all_done ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              {auto_mode ? "Auto ●" : "Auto"}
            </button>
            <button
              onClick={handleSkip}
              disabled={all_done}
              className={[
                "rounded-full px-3 py-1 text-xs font-bold bg-[#e8ecf5] text-[#6b7a99] hover:bg-[#d1d5db] transition-all",
                all_done ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
              ].join(" ")}
            >
              Skip
            </button>
            <button
              onClick={handleReset}
              className="rounded-full px-3 py-1 text-xs font-bold bg-[#e8ecf5] text-[#6b7a99] hover:bg-[#d1d5db] transition-all cursor-pointer"
              title="처음으로"
            >
              ↺
            </button>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div
        className="flex-1 mx-auto w-full max-w-2xl px-6 py-8"
        onClick={handleContentClick}
        style={{ cursor: can_advance ? "pointer" : "default" }}
      >
        {/* Illustration */}
        {story.illustration_url && (
          <div className="mb-6 overflow-hidden rounded-2xl">
            <img src={story.illustration_url} alt="chapter illustration" className="w-full object-cover" />
          </div>
        )}

        {/* Chapter badge */}
        <p className="mb-5 text-xs font-extrabold uppercase tracking-[2px] text-[#4caf72]">
          Chapter {story.chapter_number}
        </p>

        {/* Sentence list */}
        <div className="space-y-3 font-serif text-[1.05rem] leading-[1.95] text-[#1a2744]">
          {sentences.slice(0, revealed).map((sentence, idx) => {
            const is_last = idx === revealed - 1;
            const waiting = pending_idx === idx && !popup;
            return (
              <SentenceRow
                key={idx}
                sentence={sentence}
                is_last={is_last}
                waiting={waiting}
                confirmed={confirmed}
                can_advance={can_advance && is_last}
                onWordClick={handleWordClick}
              />
            );
          })}
        </div>

        <div ref={bottom_ref} className="h-6" />

        {/* Complete */}
        {all_done && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleComplete}
              disabled={completed}
              className="inline-flex items-center gap-2 rounded-full bg-[#1a2744] px-8 py-3.5 text-sm font-extrabold text-white shadow-[0_4px_20px_rgba(26,39,68,0.20)] transition-all hover:-translate-y-0.5 hover:bg-[#243358] disabled:opacity-50"
            >
              {completed ? "저장 중..." : "다음 학습으로 →"}
            </button>
          </div>
        )}
      </div>

      {/* Popup */}
      {popup && <WordCardPopup data={popup} onConfirm={handlePopupConfirm} />}

      <style>{`
        @keyframes wordBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes bounceDown {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(5px); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SentenceRow
// ---------------------------------------------------------------------------

function SentenceRow({
  sentence, is_last, waiting, confirmed, can_advance, onWordClick,
}: {
  sentence: Sentence;
  is_last: boolean;
  waiting: boolean;       // waiting for word click on this sentence
  confirmed: Set<string>;
  can_advance: boolean;   // show ▼ bounce
  onWordClick: (word: string, meaning: string) => void;
}) {
  return (
    <p style={{ animation: "fadeSlideIn 0.35s ease-out" }}>
      {sentence.parts.map((part, i) => {
        if (part.kind === "text") return <span key={i}>{part.value}</span>;
        const is_confirmed = confirmed.has(part.word);
        return (
          <mark
            key={i}
            onClick={(e) => { e.stopPropagation(); onWordClick(part.word, part.meaning); }}
            className={[
              "cursor-pointer rounded px-0.5 font-bold transition-all duration-300",
              is_confirmed
                ? "bg-[#fde68a] text-[#1a2744]"
                : "bg-transparent text-[#4caf72] underline decoration-dotted decoration-[#4caf72] underline-offset-2",
            ].join(" ")}
            style={!is_confirmed ? { animation: "wordBlink 0.85s ease-in-out infinite" } : undefined}
          >
            {part.word}
          </mark>
        );
      })}

      {/* ▼ bounce — next sentence hint */}
      {is_last && can_advance && (
        <span
          className="ml-1.5 inline-block text-sm text-[#4caf72] select-none"
          style={{ animation: "bounceDown 1s ease-in-out infinite" }}
          aria-hidden
        >
          ▼
        </span>
      )}

      {/* Word click hint */}
      {is_last && waiting && (
        <span className="ml-2 text-xs font-bold text-[#4caf72] animate-pulse select-none">
          👆 단어를 클릭하세요
        </span>
      )}
    </p>
  );
}

// ---------------------------------------------------------------------------
// WordCardPopup
// ---------------------------------------------------------------------------

function WordCardPopup({ data, onConfirm }: { data: WordPopupData; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-[0_20px_60px_rgba(26,39,68,0.20)]">
        <div className="mb-5 text-center">
          <p className="font-display text-3xl font-black text-[#1a2744]">{data.word}</p>
          {data.pronunciation && (
            <p className="mt-1 text-sm text-[#9aa3b5]">[{data.pronunciation}]</p>
          )}
          <TtsButton word={data.word} lang={data.tts_lang} />
        </div>
        <hr className="mb-5 border-[#e8ecf5]" />
        <p className="mb-4 text-center text-xl font-extrabold text-[#1a2744]">{data.meaning}</p>
        {data.example_sentence && (
          <div className="mb-6 rounded-2xl bg-[#fdf8f0] px-4 py-3 text-center">
            <p className="text-sm font-semibold italic text-[#1a2744]">"{data.example_sentence}"</p>
            {data.example_translation && (
              <p className="mt-1 text-xs text-[#6b7a99]">{data.example_translation}</p>
            )}
          </div>
        )}
        <button
          onClick={onConfirm}
          className="w-full rounded-2xl bg-[#1a2744] py-3.5 text-sm font-extrabold text-white transition-all hover:bg-[#243358]"
        >
          확인했어요 →
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TtsButton
// ---------------------------------------------------------------------------

let _tts_active = false;

function TtsButton({ word, lang }: { word: string; lang: string }) {
  const [active, set_active] = useState(false);
  const handleClick = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (_tts_active) {
      window.speechSynthesis.cancel();
      _tts_active = false;
      set_active(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(word);
    u.lang = lang;
    u.rate = 0.9;
    _tts_active = true;
    set_active(true);
    u.onend  = () => { _tts_active = false; set_active(false); };
    u.onerror = () => { _tts_active = false; set_active(false); };
    window.speechSynthesis.speak(u);
  }, [word, lang]);

  return (
    <button
      onClick={handleClick}
      className={[
        "mt-2 flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition-colors mx-auto",
        active ? "bg-[#4caf72] text-white" : "bg-[#e8ecf5] text-[#6b7a99] hover:bg-[#d1d5db]",
      ].join(" ")}
    >
      🔊 {active ? "재생 중..." : "발음 듣기"}
    </button>
  );
}
