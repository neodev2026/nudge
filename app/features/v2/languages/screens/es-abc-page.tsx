import { Link } from "react-router";

export const meta = () => [
  { title: "스페인어 알파벳 — Nudge" },
  {
    name: "description",
    content: "스페인어 알파벳과 발음 규칙 Pre-A1 과정. 7세션 35개 발음 단위.",
  },
];

const youtubeLinks = [
  {
    title: "스페인어 알파벳 발음",
    href: "https://www.youtube.com/results?search_query=스페인어+알파벳+발음",
  },
  {
    title: "Spanish alphabet pronunciation",
    href: "https://www.youtube.com/results?search_query=spanish+alphabet+pronunciation",
  },
  {
    title: "SpanishPod101 알파벳",
    href: "https://www.youtube.com/results?search_query=SpanishPod101+alphabet",
  },
];

export default function EsAbcPage() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link to="/languages/es" className="hover:text-gray-800">
            스페인어 로드맵
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-gray-800">ABC</span>
        </nav>

        {/* Level Header */}
        <div className="mb-10">
          <p className="mb-2 text-3xl">🇪🇸</p>
          <h1 className="mb-3 text-3xl font-black text-gray-900 md:text-4xl">
            Pre-A1 · Español ABC
          </h1>
          <p className="mb-4 text-lg font-semibold text-gray-800">
            스페인어의 첫 관문입니다.
          </p>
          <p className="max-w-xl leading-relaxed text-gray-600">
            발음 규칙을 한 번 익히면
            <br />
            처음 보는 단어도 완벽하게 읽을 수 있습니다.
            <br />
            <br />
            영어 알파벳을 알아도 스페인어 이름은 전혀 다릅니다.
            <br />
            A, B, C가 "아, 베, 세"가 아니에요.
          </p>
        </div>

        {/* 독일어 비교 */}
        <section className="mb-10 rounded-xl border border-blue-200 bg-blue-50 p-6">
          <p className="mb-2 font-bold text-blue-900">🇪🇸 독일어보다 훨씬 가볍습니다</p>
          <p className="text-sm leading-relaxed text-blue-800">
            모음 5개(A/E/I/O/U)는 예외 없이 한 가지로 일정하게 발음합니다.
            <br />
            영어처럼 상황마다 달라지는 것이 없습니다.
            <br />
            특수 알파벳도 Ñ 하나뿐입니다.
            <br />
            <br />
            7세션만 완주하면 스페인어로 된 모든 텍스트를
            <br />
            소리 내어 읽을 수 있게 됩니다.
          </p>
        </section>

        {/* 배우는 내용 */}
        <section className="mb-10 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-black text-gray-900">배우는 내용</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              "알파벳 27자 이름과 발음 (A~Z + Ñ)",
              "강세 기호 á é í ó ú 읽기 규칙",
              "C의 두 얼굴: a/o/u 앞 [k], e/i 앞 [s]",
              "G의 두 얼굴: a/o/u 앞 [g], e/i 앞 [h]",
              "H 묵음 규칙 (Hola → [올라])",
              "J와 G(e/i) 사이의 목청음 [h]",
              "R/RR 의 굴림 발음",
              "총 7세션, 35개 발음 단위",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 text-gray-400">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 학습 방법 */}
        <section className="mb-10 rounded-xl border border-gray-200 bg-gray-100 p-6">
          <p className="mb-2 font-bold text-gray-900">보고 듣고 따라하세요.</p>
          <p className="text-sm leading-relaxed text-gray-600">
            "rr"를 보고, [르르]를 듣고, 입으로 따라하면
            <br />
            perro, perro, perro... 그 소리가 박힙니다.
          </p>
        </section>

        {/* CTA */}
        <div className="mb-10">
          <Link
            to="/products/spanish-abc"
            className="inline-flex items-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            ABC 학습 시작하기 →
          </Link>
        </div>

        {/* YouTube 링크 */}
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

        {/* 다음 단계 안내 */}
        <section className="mb-10">
          <p className="mb-3 text-sm text-gray-500">ABC를 마치면</p>
          <Link
            to="/languages/es/a1"
            className="flex items-center justify-between rounded-xl border-2 border-green-300 bg-green-50 p-5 transition-colors hover:border-green-500"
          >
            <div>
              <div className="font-black text-gray-900">A1 · 기초</div>
              <div className="text-sm text-gray-500">일상 생존 표현 396단어</div>
            </div>
            <span className="text-gray-500">→</span>
          </Link>
        </section>

        {/* Level Nav */}
        <div className="mt-6 flex justify-end border-t border-gray-200 pt-6">
          <Link
            to="/languages/es/a1"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            A1 알아보기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
