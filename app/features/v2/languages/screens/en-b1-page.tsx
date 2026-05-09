import { Link } from "react-router";

export const meta = () => [
  { title: "영어 B1 · 중급 — Nudge" },
  {
    name: "description",
    content:
      "Oxford 3000 B1 기준 684단어. IELTS/TOEIC 기초 어휘를 137세션으로 완주합니다.",
  },
];

const topics = [
  "비즈니스와 업무 표현",
  "사회와 미디어 관련 어휘",
  "복잡한 감정과 관계",
  "추상적 개념 표현",
  "시험 빈출 단어",
];

const youtubeLinks = [
  {
    title: "BBC Learning English B1 Intermediate",
    href: "https://www.youtube.com/results?search_query=BBC+learning+english+B1+intermediate",
  },
  {
    title: "English with Lucy — Intermediate",
    href: "https://www.youtube.com/results?search_query=english+with+lucy+intermediate",
  },
  {
    title: "Oxford Online English B1",
    href: "https://www.youtube.com/results?search_query=oxford+online+english+B1",
  },
];

export default function EnB1Page() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link to="/languages/en" className="hover:text-gray-800">
            영어 로드맵
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-gray-800">B1</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <p className="mb-2 text-3xl">🇬🇧</p>
          <h1 className="mb-3 text-3xl font-black text-gray-900 md:text-4xl">
            B1 · Intermediate English
          </h1>
          <p className="max-w-xl leading-relaxed text-gray-600">
            직장인·이민 준비자를 위한 핵심 684단어.
            <br />
            업무, 일상, 시험에 꼭 필요한 중급 어휘.
          </p>
          <p className="mt-3 text-sm text-gray-400">
            Oxford 3000 B1 기준.
            <br />
            IELTS / TOEIC 기초 어휘와 높은 중복률.
          </p>
        </div>

        {/* 스펙 카드 */}
        <div className="mb-10 grid grid-cols-3 gap-3">
          {[
            { icon: "📚", value: "684단어" },
            { icon: "📅", value: "137세션" },
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

        {/* CTA */}
        <div className="mb-10">
          <Link
            to="/products/english-b1"
            className="inline-flex items-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            B1 학습 시작하기 →
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
        <div className="mt-6 flex justify-between border-t border-gray-200 pt-6">
          <Link
            to="/languages/en/a2"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            ← A2 알아보기
          </Link>
          <Link
            to="/languages/en/b2"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            B2 알아보기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
