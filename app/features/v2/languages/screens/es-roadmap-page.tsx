import { Link } from "react-router";

export const roadmapItems = [
  {
    level: "ABC",
    label: "Pre-A1 · 알파벳",
    slug: "abc",
    href: "/languages/es/abc",
    description: "스페인어 알파벳과 발음 규칙",
    detail: "알파벳 27자 + 핵심 발음 규칙, 7세션",
    sessions: 7,
    units: 35,
    unitLabel: "발음 단위",
    status: "active" as "active" | "coming_soon",
    productHref: "/products/spanish-abc",
  },
  {
    level: "A1",
    label: "A1 · 기초",
    slug: "a1",
    href: "/languages/es/a1",
    description: "Instituto Cervantes PCIC A1 기준",
    detail: "일상 생존 표현 396단어",
    sessions: 79,
    units: 396,
    unitLabel: "단어",
    status: "active" as "active" | "coming_soon",
    productHref: "/products/spanish-a1",
  },
  {
    level: "A2",
    label: "A2 · 초급",
    slug: "a2",
    href: "/languages/es/a2",
    description: "Instituto Cervantes PCIC A2 기준",
    detail: "일상 대화, 간단한 의사표현 611단어",
    sessions: 122,
    units: 611,
    unitLabel: "단어",
    status: "active" as "active" | "coming_soon",
    productHref: "/products/spanish-a2",
  },
  {
    level: "B1",
    label: "B1 · 중급",
    slug: "b1",
    href: "/languages/es/b1",
    description: "Instituto Cervantes PCIC B1 기준",
    detail: "자립적 의사소통 659단어",
    sessions: 131,
    units: 659,
    unitLabel: "단어",
    status: "active" as "active" | "coming_soon",
    productHref: "/products/spanish-b1",
  },
  {
    level: "B2",
    label: "B2 · 중상급",
    slug: "b2",
    href: "/languages/es/b2",
    description: "Instituto Cervantes PCIC B2 기준",
    detail: "복잡한 주제 토론, 전문적 의사소통 667단어",
    sessions: 133,
    units: 667,
    unitLabel: "단어",
    status: "active" as "active" | "coming_soon",
    productHref: "/products/spanish-b2",
  },
];

const levelColors: Record<string, string> = {
  ABC: "bg-gray-100 border-gray-300",
  A1: "bg-green-50 border-green-300",
  A2: "bg-yellow-50 border-yellow-300",
  B1: "bg-orange-50 border-orange-300",
  B2: "bg-red-50 border-red-300",
};

export const meta = () => [
  { title: "스페인어 로드맵 — Nudge" },
  {
    name: "description",
    content:
      "스페인어 ABC부터 B2까지 단계별 학습 로드맵. Instituto Cervantes 공인 어휘 기준.",
  },
];

export default function EsRoadmapPage() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      {/* Hero */}
      <div className="border-b border-gray-200 bg-white px-6 py-16 md:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 text-5xl">🇪🇸</div>
          <h1 className="mb-3 text-4xl font-black text-gray-900 md:text-5xl">
            스페인어
          </h1>
          <p className="mb-2 text-2xl font-bold text-gray-800">
            Español desde cero.
          </p>
          <p className="mb-6 text-lg leading-relaxed text-gray-600">
            보고, 듣고, 따라하세요.
            <br />
            머릿속에 우겨넣는 게 전략입니다.
          </p>
          <p className="mb-8 max-w-xl text-sm leading-relaxed text-gray-500">
            앱 없이. 교재 없이. 알림 하나로 시작하는 스페인어 단어 학습.
            <br />
            Instituto Cervantes 공인 어휘 기준 ABC부터 B2까지.
            <br />
            스페인 스페인어(es-ES) 기준 발음을 제공합니다.
          </p>
          <Link
            to="/languages/es/abc"
            className="inline-flex items-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            스페인어 ABC 시작하기 →
          </Link>
        </div>
      </div>

      {/* Roadmap Cards */}
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <h2 className="mb-8 text-2xl font-black text-gray-900">
          스페인어 학습 로드맵
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
                desc: "TTS가 스페인 원어민 발음으로 읽어줍니다.",
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
                  style={{ color: "#ffc400" }}
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

      {/* 스페인어 특징 */}
      <div className="px-6 py-12 md:px-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-2xl font-black text-gray-900">
            스페인어, 이게 제일 어렵죠?
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: "🇪🇸",
                title: "el / la",
                desc: "명사에 성별이 있습니다. el libro(책), la mesa(테이블). Nudge는 단어와 관사를 세트로 외웁니다.",
              },
              {
                icon: "🔄",
                title: "R / RR 발음",
                desc: "혀를 굴리는 소리가 처음엔 낯설죠. 듣고 따라하다 보면 자연스럽게 됩니다.",
              },
              {
                icon: "🔇",
                title: "묵음 H",
                desc: "hola의 h는 발음하지 않습니다. 보는 것과 듣는 것을 함께 익히세요.",
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

      {/* 마무리 CTA */}
      <div className="border-t border-gray-200 bg-white px-6 py-16 md:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-2 text-2xl font-black text-gray-900">
            ¿Listo? 준비됐나요?
          </h2>
          <p className="mb-8 text-gray-500">스페인어 여정을 시작하세요.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/languages/es/abc"
              className="inline-flex items-center justify-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
            >
              ABC부터 시작하기 →
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
