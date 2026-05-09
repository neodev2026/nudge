import { Link } from "react-router";

export const meta = () => [
  { title: "영어 A1 · 기초 — Nudge" },
  {
    name: "description",
    content: "Oxford 3000 A1 기준 884단어. 영어의 핵심 기초 어휘를 177세션으로 완주합니다.",
  },
];

const topics = [
  "관사와 기능어 (a, the, and, in, at...)",
  "인사와 자기소개",
  "숫자, 날짜, 시간",
  "가족과 사람",
  "음식과 일상용품",
  "장소와 교통",
  "기본 동사 (go, come, have, make...)",
];

const youtubeLinks = [
  {
    title: "영어 A1 기초",
    href: "https://www.youtube.com/results?search_query=영어+A1+기초",
  },
  {
    title: "BBC Learning English — Basic English",
    href: "https://www.youtube.com/results?search_query=BBC+learning+english+basic",
  },
  {
    title: "Oxford Online English A1",
    href: "https://www.youtube.com/results?search_query=oxford+online+english+A1",
  },
];

export default function EnA1Page() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link to="/languages/en" className="hover:text-gray-800">
            영어 로드맵
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-gray-800">A1</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <p className="mb-2 text-3xl">🇬🇧</p>
          <h1 className="mb-3 text-3xl font-black text-gray-900 md:text-4xl">
            A1 · Basic English
          </h1>
          <p className="max-w-xl leading-relaxed text-gray-600">
            영어의 첫걸음. 884개 핵심 단어.
            <br />
            인사, 숫자, 가족, 음식, 장소, 시간.
            <br />
            일상에서 가장 많이 쓰이는 기본 어휘.
          </p>
          <p className="mt-3 text-sm text-gray-400">
            Oxford 3000 A1 기준.
            <br />
            영국식 영어(en-GB) 발음 제공.
          </p>
        </div>

        {/* 스펙 카드 */}
        <div className="mb-10 grid grid-cols-3 gap-3">
          {[
            { icon: "📚", value: "884단어" },
            { icon: "📅", value: "177세션" },
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

        {/* A1 특이사항 */}
        <section className="mb-10 rounded-xl border border-green-200 bg-green-50 p-6">
          <p className="mb-2 font-bold text-green-900">💡 "A1인데 아는 단어 아닌가요?"</p>
          <p className="text-sm leading-relaxed text-green-800">
            Oxford A1에는 a, the, and 같은 기능어도 포함됩니다.
            <br />
            당연히 안다고 생각하는 단어들이 많을 겁니다.
            <br />
            하지만 "알아보는 것"과 "제대로 쓰는 것"은 다릅니다.
            <br />
            <br />
            예: advice는 불가산 명사라 "an advice"라고 쓰면 틀립니다.
            <br />
            Nudge의 description 카드가 이런 함정을 짚어줍니다.
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
            to="/products/english-a1"
            className="inline-flex items-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            A1 무료 체험하기 →
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
        <div className="mt-6 flex justify-end border-t border-gray-200 pt-6">
          <Link
            to="/languages/en/a2"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            A2 알아보기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
