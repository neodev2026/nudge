import { Link } from "react-router";

export const meta = () => [
  { title: "독일어 B2 · 중상급 — Nudge" },
  {
    name: "description",
    content: "Goethe-Zertifikat B2 기준. 현재 콘텐츠를 준비 중입니다.",
  },
];

export default function DeB2Page() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link to="/languages/de" className="hover:text-gray-800">
            독일어 로드맵
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-gray-800">B2</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <p className="mb-2 text-3xl">🇩🇪</p>
          <h1 className="mb-3 text-3xl font-black text-gray-900 md:text-4xl">
            B2 · Fortgeschrittene Sprachverwendung
          </h1>
          <p className="max-w-xl leading-relaxed text-gray-600">
            독일어로 복잡한 주제를 토론할 수 있는 수준.
            <br />
            대학 수업, 업무 미팅, 전문적 의사소통.
            <br />
            Goethe-Zertifikat B2 기준 어휘.
          </p>
        </div>

        {/* 준비 중 배너 */}
        <div className="mb-10 rounded-xl border-2 border-gray-300 bg-white p-8 text-center">
          <div className="mb-4 text-4xl">🚧</div>
          <h2 className="mb-2 text-xl font-black text-gray-900">
            현재 콘텐츠를 준비 중입니다.
          </h2>
          <p className="text-sm leading-relaxed text-gray-500">
            B1 어휘를 완주하고 기다려주세요.
            <br />
            오픈 시 이메일 또는 Discord로 알려드립니다.
          </p>
        </div>

        {/* CTA */}
        <div className="mb-10 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/languages/de/b1"
            className="inline-flex items-center justify-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            B1부터 시작하기 →
          </Link>
          <Link
            to="/languages/de"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-500"
          >
            전체 로드맵 보기 →
          </Link>
        </div>

        {/* Level Nav */}
        <div className="mt-6 flex border-t border-gray-200 pt-6">
          <Link
            to="/languages/de/b1"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            ← B1 알아보기
          </Link>
        </div>
      </div>
    </div>
  );
}
