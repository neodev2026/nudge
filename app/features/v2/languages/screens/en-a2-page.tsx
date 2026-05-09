import { Link } from "react-router";

export const meta = () => [
  { title: "영어 A2 · 초급 — Nudge" },
  {
    name: "description",
    content: "Oxford 3000 A2 기준 783단어. 일상 소통 가능한 수준을 157세션으로 완주합니다.",
  },
];

const topics = [
  "과거/미래 표현",
  "쇼핑과 서비스 이용",
  "여행과 교통",
  "건강과 신체",
  "감정과 의견 표현",
  "비교와 설명",
];

const youtubeLinks = [
  {
    title: "BBC Learning English A2",
    href: "https://www.youtube.com/results?search_query=BBC+learning+english+A2",
  },
  {
    title: "English with Lucy — Elementary",
    href: "https://www.youtube.com/results?search_query=english+with+lucy+elementary",
  },
  {
    title: "Oxford Online English A2",
    href: "https://www.youtube.com/results?search_query=oxford+online+english+A2",
  },
];

export default function EnA2Page() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link to="/languages/en" className="hover:text-gray-800">
            영어 로드맵
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-gray-800">A2</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <p className="mb-2 text-3xl">🇬🇧</p>
          <h1 className="mb-3 text-3xl font-black text-gray-900 md:text-4xl">
            A2 · Elementary English
          </h1>
          <p className="max-w-xl leading-relaxed text-gray-600">
            일상 소통이 가능한 수준. 783개 단어.
            <br />
            쇼핑, 여행, 간단한 업무 대화까지.
          </p>
          <p className="mt-3 text-sm text-gray-400">Oxford 3000 A2 기준.</p>
        </div>

        {/* 스펙 카드 */}
        <div className="mb-10 grid grid-cols-3 gap-3">
          {[
            { icon: "📚", value: "783단어" },
            { icon: "📅", value: "157세션" },
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
            to="/products/english-a2"
            className="inline-flex items-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            A2 학습 시작하기 →
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
            to="/languages/en/a1"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            ← A1 알아보기
          </Link>
          <Link
            to="/languages/en/b1"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            B1 알아보기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
