import { Link } from "react-router";

export const meta = () => [
  { title: "독일어 ABC · Pre-A1 — Nudge" },
  {
    name: "description",
    content: "독일어 알파벳과 발음 조합을 배웁니다. 10세션, 51개 발음 단위.",
  },
];

const youtubeLinks = [
  {
    title: "독일어 알파벳 발음",
    href: "https://www.youtube.com/results?search_query=독일어+알파벳+발음",
  },
  {
    title: "German Alphabet Pronunciation",
    href: "https://www.youtube.com/results?search_query=german+alphabet+pronunciation",
  },
  {
    title: "Deutsch mit Marija (채널)",
    href: "https://www.youtube.com/results?search_query=Deutsch+mit+Marija+alphabet",
  },
];

export default function DeAbcPage() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      <div className="mx-auto max-w-3xl px-6 py-10 md:px-10">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-gray-500">
          <Link to="/languages/de" className="hover:text-gray-800">
            독일어 로드맵
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-gray-800">ABC</span>
        </nav>

        {/* Level Header */}
        <div className="mb-10">
          <p className="mb-2 text-3xl">🇩🇪</p>
          <h1 className="mb-3 text-3xl font-black text-gray-900 md:text-4xl">
            Pre-A1 · Deutsch ABC
          </h1>
          <p className="mb-4 text-lg font-semibold text-gray-800">
            독일어의 첫 번째 관문. 발음입니다.
          </p>
          <p className="max-w-xl leading-relaxed text-gray-600">
            독일어는 한 번 발음 규칙을 알면
            <br />
            처음 보는 단어도 읽을 수 있습니다.
            <br />
            철자와 발음이 거의 일치하기 때문입니다.
          </p>
        </div>

        {/* 배우는 내용 */}
        <section className="mb-10 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-black text-gray-900">배우는 내용</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {[
              "알파벳 26자 이름과 발음",
              "움라우트 Ä Ö Ü 와 ß",
              "자주 쓰이는 발음 조합: ch / sch / tsch / ei / ie / eu / st / sp 등",
              "총 10세션, 51개 발음 단위",
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
            "sch"를 보고, [슈]를 듣고, 입으로 따라하면
            <br />
            Schule, Schule, Schule... 그 소리가 박힙니다.
          </p>
        </section>

        {/* CTA */}
        <div className="mb-10">
          <Link
            to="/products/deutsch-abc"
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
            to="/languages/de/a1"
            className="flex items-center justify-between rounded-xl border-2 border-green-300 bg-green-50 p-5 transition-colors hover:border-green-500"
          >
            <div>
              <div className="font-black text-gray-900">A1 · 기초</div>
              <div className="text-sm text-gray-500">일상 생존 표현 625단어</div>
            </div>
            <span className="text-gray-500">→</span>
          </Link>
        </section>

        {/* Level Nav */}
        <div className="mt-6 flex justify-end border-t border-gray-200 pt-6">
          <Link
            to="/languages/de/a1"
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            A1 알아보기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
