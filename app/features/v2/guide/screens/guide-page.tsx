/**
 * /guide — How Nudge Works
 *
 * Static page introducing the three learning methods.
 * Publicly accessible without authentication.
 */
import { Link } from "react-router";

const TRIAL_MARATHON_SLUG = "spanish-a1";

export const meta = () => [
  { title: "학습 방법 — Nudge" },
  {
    name: "description",
    content:
      "마라톤 모드로 전체를 빠르게 완주하고 무한반복. 세션별 학습과 Leni AI 대화까지 — Nudge의 세 가지 학습 방법을 소개합니다.",
  },
];

export default function GuidePage() {
  const trialHref = `/products/${TRIAL_MARATHON_SLUG}/marathon`;

  return (
    <div className="min-h-screen bg-[#fdf8f0]">

      {/* ── Hero ── */}
      <div className="border-b border-[#1a2744]/[0.07] bg-white/60 px-6 py-16 backdrop-blur-sm md:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[2px] text-[#4caf72]">
            How It Works
          </p>
          <h1 className="mb-4 font-display text-[clamp(2rem,4vw,3rem)] font-black leading-snug text-[#1a2744]">
            Nudge는 이렇게 학습합니다
          </h1>
          <p className="text-base leading-[1.8] text-[#6b7a99]">
            세 가지 방법, 하나의 목표 — 기억
          </p>
        </div>
      </div>

      {/* ── Methods ── */}
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-16 md:px-10">

        {/* 01. Marathon Mode */}
        <section className="rounded-2xl bg-white p-8 shadow-[0_8px_32px_rgba(26,39,68,0.08)]">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fdf8f0] text-3xl">
              🏃
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[2px] text-[#4caf72]">
                Method 01
              </p>
              <h2 className="font-display text-xl font-black text-[#1a2744]">
                마라톤 모드 — 전체를 빠르게, 무한반복
              </h2>
            </div>
          </div>
          <p className="mb-6 text-base leading-[1.8] text-[#6b7a99]">
            전체 단어를 처음부터 끝까지 한 번에 학습하는 모드입니다.
            완주하면 처음부터 다시. 무한반복이 기억을 만듭니다.
          </p>
          <div className="mb-6 space-y-3">
            <h3 className="text-sm font-extrabold text-[#1a2744]">어떻게 작동하나요?</h3>
            <ul className="space-y-2 text-sm leading-[1.7] text-[#6b7a99]">
              {[
                "TTS가 단어와 의미를 자동으로 읽어줍니다",
                "자동 넘김으로 영상처럼 흘러갑니다",
                "5단어마다 미니 퀴즈로 기억을 확인합니다",
                "운동하면서, 이동하면서 틀어놓으세요",
              ].map(text => (
                <li key={text} className="flex gap-2">
                  <span className="shrink-0">•</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-[#1a2744]">이런 분께 추천</h3>
            <ul className="space-y-2 text-sm leading-[1.7] text-[#6b7a99]">
              {[
                "빠르게 전체 내용을 훑고 싶은 분",
                "틈새 시간에 학습하고 싶은 분",
                "반복 노출로 자연스럽게 익히고 싶은 분",
              ].map(text => (
                <li key={text} className="flex gap-2">
                  <span className="shrink-0">•</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 02. Session Learning */}
        <section className="rounded-2xl bg-white p-8 shadow-[0_8px_32px_rgba(26,39,68,0.08)]">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fdf8f0] text-3xl">
              📚
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[2px] text-[#4caf72]">
                Method 02
              </p>
              <h2 className="font-display text-xl font-black text-[#1a2744]">
                세션별 학습 — 차근차근, 퀴즈로 확인
              </h2>
            </div>
          </div>
          <p className="mb-6 text-base leading-[1.8] text-[#6b7a99]">
            5단어씩 세션으로 나누어 체계적으로 학습합니다.
            퀴즈와 문장 연습으로 기억을 단단히 새깁니다.
          </p>
          <ul className="space-y-2 text-sm leading-[1.7] text-[#6b7a99]">
            {[
              "5단어 단위 집중 학습",
              "퀴즈로 즉시 확인",
              "매일 알림으로 자동 복습 스케줄",
            ].map(text => (
              <li key={text} className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 03. Leni */}
        <section className="rounded-2xl bg-white p-8 shadow-[0_8px_32px_rgba(26,39,68,0.08)]">
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#fdf8f0] text-3xl">
              💬
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[2px] text-[#4caf72]">
                Method 03
              </p>
              <h2 className="font-display text-xl font-black text-[#1a2744]">
                Leni와 학습 — 목표 언어로 직접 대화
              </h2>
            </div>
          </div>
          <p className="mb-6 text-base leading-[1.8] text-[#6b7a99]">
            AI 튜터 Leni와 목표 언어로 직접 대화합니다.
            배운 단어로 실제 대화 연습까지.
          </p>
          <ul className="space-y-2 text-sm leading-[1.7] text-[#6b7a99]">
            {[
              "목표 언어로만 대화 (번역 제공)",
              "약점 단어 집중 케어",
              "자유 대화로 실전 감각 훈련",
            ].map(text => (
              <li key={text} className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ── CTA ── */}
      <section className="px-6 py-16 text-center">
        <h2 className="mb-4 font-display text-[clamp(1.6rem,3vw,2.2rem)] font-black leading-snug text-[#1a2744]">
          직접 체험해보세요
        </h2>
        <p className="mx-auto mb-10 max-w-md text-base leading-[1.8] text-[#6b7a99]">
          로그인 없이 바로 마라톤 모드를 체험할 수 있습니다.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            to={trialHref}
            className="inline-flex items-center justify-center rounded-full bg-[#1a2744] px-8 py-4 text-base font-extrabold text-white shadow-[0_4px_20px_rgba(26,39,68,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(26,39,68,0.35)]"
          >
            지금 바로 체험 →
          </Link>
          <Link
            to="/products"
            className="inline-flex items-center justify-center rounded-full border-2 border-[#1a2744]/20 bg-white px-8 py-4 text-base font-extrabold text-[#1a2744] transition-all hover:-translate-y-0.5 hover:border-[#1a2744]/40"
          >
            학습 상품 보기 →
          </Link>
        </div>
      </section>

    </div>
  );
}
