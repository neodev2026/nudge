import { Link } from "react-router";

export const meta = () => [
  { title: "영어 B2 · 중상급 — Nudge" },
  {
    name: "description",
    content:
      "Oxford 3000 B2 기준 595단어. Oxford 3000 전체 완주의 마지막 레벨. 119세션으로 완주합니다.",
  },
];

const topics = [
  "학술 및 전문 분야 어휘",
  "추상적 주제 토론",
  "뉘앙스와 관용 표현",
  "복잡한 문장 구성에 쓰이는 어휘",
  "고급 형용사·부사",
];

const youtubeLinks = [
  {
    title: "BBC Learning English B2 Upper Intermediate",
    href: "https://www.youtube.com/results?search_query=BBC+learning+english+B2+upper+intermediate",
  },
  {
    title: "English with Lucy — Upper Intermediate",
    href: "https://www.youtube.com/results?search_query=english+with+lucy+upper+intermediate",
  },
  {
    title: "Oxford Online English B2",
    href: "https://www.youtube.com/results?search_query=oxford+online+english+B2",
  },
];

export default function EnB2Page() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link to="/languages/en" className="hover:text-gray-800">
            영어 로드맵
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-gray-800">B2</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <p className="mb-2 text-3xl">🇬🇧</p>
          <h1 className="mb-3 text-3xl font-black text-gray-900 md:text-4xl">
            B2 · Upper-Intermediate English
          </h1>
          <p className="max-w-xl leading-relaxed text-gray-600">
            고급 표현력의 완성. 595개 단어.
            <br />
            복잡한 주제도 영어로 다룰 수 있게 됩니다.
          </p>
          <p className="mt-3 text-sm text-gray-400">
            Oxford 3000 B2 기준.
            <br />
            Oxford 3000 전체 완주의 마지막 레벨.
          </p>
        </div>

        {/* 스펙 카드 */}
        <div className="mb-10 grid grid-cols-3 gap-3">
          {[
            { icon: "📚", value: "595단어" },
            { icon: "📅", value: "119세션" },
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

        {/* B2 달성의 의미 */}
        <section className="mb-10 rounded-xl border-2 border-red-200 bg-red-50 p-6">
          <p className="mb-2 font-bold text-red-900">🎯 Oxford 3000을 완주하면</p>
          <p className="text-sm leading-relaxed text-red-800">
            전 세계 영어 텍스트의 대부분을 읽고 이해할 수 있는
            <br />
            어휘 기반이 완성됩니다.
            <br />
            A1~B2 합산 2,946단어.
            <br />
            Nudge로 완주하면 자연스럽게 도달합니다.
          </p>
        </section>

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
            to="/products/english-b2"
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
            to="/languages/en/b1"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            ← B1 알아보기
          </Link>
        </div>
      </div>
    </div>
  );
}
