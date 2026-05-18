import { Link } from "react-router";

export const meta = () => [
  { title: "스페인어 A1 · 기초 — Nudge" },
  {
    name: "description",
    content:
      "Instituto Cervantes PCIC A1 기준 396단어. 일상 생존 표현을 79세션으로 완주합니다.",
  },
];

const topics = [
  "인사와 자기소개 (Hola, ¿Cómo te llamas?)",
  "숫자와 날짜",
  "가족과 사람",
  "집과 생활용품",
  "음식과 음료",
  "교통과 장소",
  "직업과 일상",
];

const youtubeLinks = [
  {
    title: "스페인어 A1 기초",
    href: "https://www.youtube.com/results?search_query=스페인어+A1+기초",
  },
  {
    title: "Español con Juan A1",
    href: "https://www.youtube.com/results?search_query=español+con+juan+A1",
  },
  {
    title: "SpanishPod101 A1 Beginner",
    href: "https://www.youtube.com/results?search_query=SpanishPod101+A1+beginner",
  },
];

export default function EsA1Page() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link to="/languages/es" className="hover:text-gray-800">
            스페인어 로드맵
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-gray-800">A1</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <p className="mb-2 text-3xl">🇪🇸</p>
          <h1 className="mb-3 text-3xl font-black text-gray-900 md:text-4xl">
            A1 · Español básico
          </h1>
          <p className="max-w-xl leading-relaxed text-gray-600">
            스페인어 생존 어휘 396단어.
            <br />
            인사, 숫자, 날짜, 가족, 음식, 교통.
            <br />
            스페인에서 길을 찾을 수 있을 정도의 어휘.
          </p>
          <p className="mt-3 text-sm text-gray-400">
            Instituto Cervantes PCIC A1 기준.
            <br />
            스페인 스페인어(es-ES) 발음 제공.
          </p>
        </div>

        {/* 스펙 카드 */}
        <div className="mb-10 grid grid-cols-3 gap-3">
          {[
            { icon: "📚", value: "396단어" },
            { icon: "📅", value: "79세션" },
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

        {/* A1 특이사항 */}
        <section className="mb-10 rounded-xl border border-green-200 bg-green-50 p-6">
          <p className="mb-2 font-bold text-green-900">💡 알아두면 좋은 것</p>
          <p className="text-sm leading-relaxed text-green-800">
            스페인어는 의문문 앞에 ¿, 감탄문 앞에 ¡를 붙입니다.
            <br />
            ¿Cómo estás? (어떻게 지내요?)
            <br />
            ¡Qué bueno! (정말 좋네요)
            <br />
            Nudge 카드에서 자연스럽게 눈에 익게 됩니다.
          </p>
        </section>

        {/* CTA */}
        <div className="mb-10">
          <Link
            to="/products/spanish-a1"
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
        <div className="mt-6 flex justify-between border-t border-gray-200 pt-6">
          <Link
            to="/languages/es/abc"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            ← ABC 알아보기
          </Link>
          <Link
            to="/languages/es/a2"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            A2 알아보기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
