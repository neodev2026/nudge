import { Link } from "react-router";

export const meta = () => [
  { title: "스페인어 B2 · 중상급 — Nudge" },
  {
    name: "description",
    content:
      "Instituto Cervantes PCIC B2 기준 667단어. DELE B2 시험 준비 레벨을 133세션으로 완주합니다.",
  },
];

const topics = [
  "복잡한 텍스트 이해와 표현",
  "전문 분야 어휘 (의학, 법률, 경제)",
  "추상적 주제 토론",
  "문학적 표현과 관용어",
  "스페인어권 역사와 문화",
];

const youtubeLinks = [
  {
    title: "DELE B2 스페인어 준비",
    href: "https://www.youtube.com/results?search_query=DELE+B2+스페인어",
  },
  {
    title: "Dreaming Spanish Advanced",
    href: "https://www.youtube.com/results?search_query=dreaming+spanish+advanced",
  },
  {
    title: "Español con Víctor B2",
    href: "https://www.youtube.com/results?search_query=español+con+victor+B2",
  },
];

export default function EsB2Page() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link to="/languages/es" className="hover:text-gray-800">
            스페인어 로드맵
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-gray-800">B2</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <p className="mb-2 text-3xl">🇪🇸</p>
          <h1 className="mb-3 text-3xl font-black text-gray-900 md:text-4xl">
            B2 · Español avanzado
          </h1>
          <p className="max-w-xl leading-relaxed text-gray-600">
            스페인어로 복잡한 주제를 토론할 수 있는 레벨.
            <br />
            대학 수업, 업무 미팅, 전문적 의사소통.
          </p>
          <p className="mt-3 text-sm text-gray-400">
            Instituto Cervantes PCIC B2 / DELE B2 시험 준비 기준 어휘.
          </p>
        </div>

        {/* 스펙 카드 */}
        <div className="mb-10 grid grid-cols-3 gap-3">
          {[
            { icon: "📚", value: "667단어" },
            { icon: "📅", value: "133세션" },
            { icon: "⏱️", value: "세션당 약 5분" },
          ].map((s) => (
            <div
              key={s.value}
              className="rounded-xl border border-gray-200 bg-white p-4 text-center"
            >
              <div className="mb-1 text-2xl">{s.icon}</div>
              <div className="text-sm font-semibold text-gray-700">{s.value}</div>
            </div>
          ))}
        </div>

        {/* 주요 학습 주제 */}
        <section className="mb-10 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-black text-gray-900">이 단계에서 배우는 것</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {topics.map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-0.5 text-gray-400">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* B2 달성의 의미 */}
        <section className="mb-10 rounded-xl border-2 border-red-200 bg-red-50 p-6">
          <p className="mb-2 font-bold text-red-900">🎯 B2는 무엇을 의미하나요?</p>
          <p className="text-sm leading-relaxed text-red-800">
            DELE B2 취득 시 스페인 및 스페인 대학 입학 요건을 충족합니다.
            <br />
            스페인어권에서 전문적 업무 의사소통이 가능한 레벨입니다.
            <br />
            Nudge의 B2 어휘 완주가 그 첫걸음입니다.
          </p>
        </section>

        {/* CTA */}
        <div className="mb-10">
          <Link
            to="/products/spanish-b2"
            className="inline-flex items-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            B2 학습 시작하기 →
          </Link>
        </div>

        {/* YouTube */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-black text-gray-900">함께 보면 좋은 영상</h2>
          <div className="space-y-2">
            {youtubeLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-gray-400"
              >
                <span className="text-red-600">▶</span>
                <span className="text-sm text-gray-700">{link.title}</span>
                <span className="ml-auto text-xs text-gray-400">YouTube ↗</span>
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            외부 링크입니다. Nudge가 제작한 콘텐츠가 아닙니다.
          </p>
        </section>

        {/* Level Nav */}
        <div className="mt-6 flex border-t border-gray-200 pt-6">
          <Link
            to="/languages/es/b1"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            ← B1 알아보기
          </Link>
        </div>
      </div>
    </div>
  );
}
