import { Link } from "react-router";

export const roadmapItems = [
  {
    level: "A1",
    label: "A1 · 기초",
    slug: "a1",
    href: "/languages/en/a1",
    description: "Oxford 3000 A1 기준",
    detail: "영어의 첫걸음. 884개 핵심 단어",
    sessions: 177,
    units: 884,
    unitLabel: "단어",
    status: "active" as "active" | "coming_soon",
    productHref: "/products/english-a1",
  },
  {
    level: "A2",
    label: "A2 · 초급",
    slug: "a2",
    href: "/languages/en/a2",
    description: "Oxford 3000 A2 기준",
    detail: "일상 소통 가능한 수준. 783개 단어",
    sessions: 157,
    units: 783,
    unitLabel: "단어",
    status: "active" as "active" | "coming_soon",
    productHref: "/products/english-a2",
  },
  {
    level: "B1",
    label: "B1 · 중급",
    slug: "b1",
    href: "/languages/en/b1",
    description: "Oxford 3000 B1 기준",
    detail: "자립적 의사소통. 684개 단어",
    sessions: 137,
    units: 684,
    unitLabel: "단어",
    status: "active" as "active" | "coming_soon",
    productHref: "/products/english-b1",
  },
  {
    level: "B2",
    label: "B2 · 중상급",
    slug: "b2",
    href: "/languages/en/b2",
    description: "Oxford 3000 B2 기준",
    detail: "고급 표현력. 595개 단어",
    sessions: 119,
    units: 595,
    unitLabel: "단어",
    status: "active" as "active" | "coming_soon",
    productHref: "/products/english-b2",
  },
];

const levelColors: Record<string, string> = {
  A1: "bg-green-50 border-green-300",
  A2: "bg-yellow-50 border-yellow-300",
  B1: "bg-orange-50 border-orange-300",
  B2: "bg-red-50 border-red-300",
};

export const meta = () => [
  { title: "영어 로드맵 — Nudge" },
  {
    name: "description",
    content: "영어 A1부터 B2까지 Oxford 3000 기반 단계별 학습 로드맵.",
  },
];

export default function EnRoadmapPage() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      {/* Hero */}
      <div className="border-b border-gray-200 bg-white px-6 py-16 md:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 text-5xl">🇬🇧</div>
          <h1 className="mb-3 text-4xl font-black text-gray-900 md:text-5xl">
            영어
          </h1>
          <p className="mb-2 text-2xl font-bold text-gray-800">
            알고 있다고 생각했던 단어,
          </p>
          <p className="mb-6 text-lg leading-relaxed text-gray-600">
            실제로는 몇 개나 알고 있나요?
            <br />
            Oxford 3000 기준으로 A1부터 다시. 제대로.
          </p>
          <p className="mb-8 max-w-xl text-sm leading-relaxed text-gray-500">
            앱 없이. 교재 없이. 알림 하나로 시작하는 영어 단어 학습.
            <br />
            Oxford 3000 기준 어휘 · 영국식 영어(en-GB) 발음 제공.
          </p>
          <Link
            to="/languages/en/a1"
            className="inline-flex items-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            A1부터 다시 시작하기 →
          </Link>
        </div>
      </div>

      {/* Roadmap Cards */}
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <h2 className="mb-8 text-2xl font-black text-gray-900">
          영어 학습 로드맵
        </h2>
        <div className="space-y-4">
          {roadmapItems.map((item) => {
            const colorClass =
              levelColors[item.level] ?? "bg-gray-50 border-gray-200";
            return (
              <Link
                key={item.level}
                to={item.href}
                className={`block rounded-xl border-2 p-5 transition-colors ${colorClass} hover:border-gray-500`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-lg font-black text-gray-900">
                        {item.level}
                      </span>
                      <span className="text-sm text-gray-600">
                        {item.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-700">
                      {item.description}
                    </p>
                    <p className="text-sm text-gray-500">{item.detail}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-black text-gray-900">
                      {item.units.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.unitLabel}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  {item.sessions}세션
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 학습 방법 소개 */}
      <div className="border-t border-gray-200 bg-white px-6 py-12 md:px-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-2xl font-black text-gray-900">
            왕도는 없습니다. 반복만이 답입니다.
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: "①",
                title: "보세요",
                desc: "단어가 뜨면 눈으로 읽습니다.",
              },
              {
                step: "②",
                title: "들으세요",
                desc: "TTS가 영국식 원어민 발음으로 읽어줍니다.",
              },
              {
                step: "③",
                title: "따라하세요",
                desc: "소리를 따라 입으로 따라합니다.",
              },
            ].map((s) => (
              <div key={s.step} className="rounded-xl bg-[#fdf8f0] p-5">
                <div
                  className="mb-2 text-xl font-black"
                  style={{ color: "#C8102E" }}
                >
                  {s.step}
                </div>
                <div className="font-bold text-gray-900">{s.title}</div>
                <div className="text-sm text-gray-500">{s.desc}</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-relaxed text-gray-500">
            5단어마다 미니 퀴즈. 50단어마다 복습 퀴즈.
            <br />
            완주하면 처음부터 다시. 이게 전부입니다.
          </p>
        </div>
      </div>

      {/* 영어 재학습의 필요성 */}
      <div className="px-6 py-12 md:px-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-2xl font-black text-gray-900">
            학교에서 배웠는데, 왜 또 해야 하나요?
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: "📚",
                title: "수동 어휘 vs 능동 어휘",
                desc: "읽을 때 알아보는 단어와 실제로 쓸 수 있는 단어는 다릅니다. Nudge는 반복 노출로 수동 어휘를 능동 어휘로 바꿉니다.",
              },
              {
                icon: "🔤",
                title: "콩글리시 교정",
                desc: '"아이스 아메리카노 한 잔 주세요." 영어처럼 들리지만 실제로는 통하지 않습니다. Oxford 기준 단어로 진짜 영어를 익힙니다.',
              },
              {
                icon: "🎧",
                title: "발음 재교육",
                desc: "한국식으로 굳어진 영어 발음. TTS 반복 노출로 귀와 입을 다시 훈련합니다.",
              },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-xl text-gray-800">
                  {c.icon}
                </div>
                <div className="mb-1 font-bold text-gray-900">{c.title}</div>
                <div className="text-sm text-gray-500">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Oxford 3000 소개 */}
      <div className="border-t border-gray-200 bg-white px-6 py-12 md:px-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-2xl font-black text-gray-900">
            왜 Oxford 3000인가요?
          </h2>
          <p className="text-sm leading-relaxed text-gray-600">
            Oxford 3000은 Oxford University Press가 선정한
            <br />
            영어에서 가장 중요한 3,000개 단어 목록입니다.
            <br />
            일상 영어 텍스트의 대부분을 커버합니다.
            <br />
            <br />
            A1부터 B2까지 CEFR 레벨별로 분류되어 있어
            <br />
            단계적 학습에 최적화되어 있습니다.
          </p>
        </div>
      </div>

      {/* 마무리 CTA */}
      <div className="px-6 py-16 md:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-2 text-2xl font-black text-gray-900">
            Ready? 시작할 준비가 됐나요?
          </h2>
          <p className="mb-8 text-gray-500">
            Oxford 3000으로 영어 어휘를 제대로 완성하세요.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/languages/en/a1"
              className="inline-flex items-center justify-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
            >
              A1부터 시작하기 →
            </Link>
            <Link
              to="/products"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-500"
            >
              전체 상품 보기 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
