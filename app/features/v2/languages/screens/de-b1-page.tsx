import { Link } from "react-router";

export const meta = () => [
  { title: "독일어 B1 · 중급 — Nudge" },
  {
    name: "description",
    content:
      "Goethe-Zertifikat B1 기준 1,160단어. 자립적 의사소통 레벨을 232세션으로 완주합니다.",
  },
];

const topics = [
  "사회와 환경 이슈",
  "직장과 비즈니스 표현",
  "미디어와 문화",
  "복잡한 감정과 관계 표현",
  "독일 문화 및 사회 관련 어휘",
];

const youtubeLinks = [
  {
    title: "Nicos Weg B1 (Goethe-Institut 공식)",
    href: "https://www.youtube.com/results?search_query=Nicos+Weg+B1",
  },
  {
    title: "DW Deutsch Lernen B1",
    href: "https://www.youtube.com/results?search_query=DW+Deutsch+Lernen+B1",
  },
  {
    title: "Easy German B1",
    href: "https://www.youtube.com/results?search_query=easy+german+B1",
  },
];

export default function DeB1Page() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link to="/languages/de" className="hover:text-gray-800">
            독일어 로드맵
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-gray-800">B1</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <p className="mb-2 text-3xl">🇩🇪</p>
          <h1 className="mb-3 text-3xl font-black text-gray-900 md:text-4xl">
            B1 · Selbstständige Sprachverwendung
          </h1>
          <p className="max-w-xl leading-relaxed text-gray-600">
            자립적 의사소통의 시작.
            <br />
            뉴스를 이해하고, 의견을 말하고,
            <br />
            독일 생활에 적응할 수 있는 레벨.
          </p>
          <p className="mt-3 text-sm text-gray-400">
            Goethe-Zertifikat B1 / ÖSD B1 시험 준비 기준 어휘.
          </p>
        </div>

        {/* 스펙 카드 */}
        <div className="mb-10 grid grid-cols-3 gap-3">
          {[
            { icon: "📚", value: "1,160단어" },
            { icon: "📅", value: "232세션" },
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

        {/* 주의사항 배너 */}
        <div className="mb-10 rounded-xl border-2 border-orange-300 bg-orange-50 p-5">
          <p className="mb-1 font-bold text-orange-800">
            ⚠️ B1은 A1+A2보다 많은 1,160단어입니다
          </p>
          <p className="text-sm leading-relaxed text-orange-700">
            마라톤 완주까지 더 긴 시간이 걸립니다.
            <br />
            하지만 Nudge는 강제하지 않습니다.
            <br />
            매일 조금씩, 알림이 데려다줍니다.
          </p>
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

        {/* CTA */}
        <div className="mb-10">
          <Link
            to="/products/deutsch-b1"
            className="inline-flex items-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            B1 학습 시작하기 →
          </Link>
        </div>

        {/* Story Learning 크로스셀 */}
        <section className="mb-10">
          <p className="mb-3 text-sm text-gray-500">B1 어휘를 이야기로 익혀보세요</p>
          <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 p-6">
            <div className="mb-2 text-3xl">📖</div>
            <div className="mb-1 text-lg font-black text-gray-900">백설공주, 7개의 그림형제</div>
            <div className="mb-4 text-sm text-gray-500">독일어 B1 어휘로 동화 · 20챕터</div>
            <Link
              to="/products/story-deutsch-b1-snowwhite"
              className="text-sm font-semibold text-yellow-700 hover:text-yellow-900"
            >
              Story 학습 보기 →
            </Link>
          </div>
        </section>

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
        <div className="mt-6 flex justify-between border-t border-gray-200 pt-6">
          <Link
            to="/languages/de/a2"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            ← A2 알아보기
          </Link>
          <Link
            to="/languages/de/b2"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            B2 알아보기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
