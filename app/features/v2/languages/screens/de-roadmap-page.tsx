import { Link } from "react-router";

export type RoadmapItem = {
  level: string;
  label: string;
  slug: string;
  href: string;
  description: string;
  detail: string;
  sessions: number | null;
  units: number | null;
  unitLabel: string | null;
  status: "active" | "coming_soon";
  productHref: string | null;
};

export const roadmapItems: RoadmapItem[] = [
  {
    level: "ABC",
    label: "Pre-A1 · 알파벳",
    slug: "abc",
    href: "/languages/de/abc",
    description: "알파벳 30자 + 발음 패턴 20개",
    detail: "독일어 소리의 규칙을 먼저 익힙니다.",
    sessions: 10,
    units: 51,
    unitLabel: "발음 단위",
    status: "active",
    productHref: "/products/deutsch-abc",
  },
  {
    level: "A1",
    label: "A1 · 기초",
    slug: "a1",
    href: "/languages/de/a1",
    description: "Goethe-Zertifikat A1 기준",
    detail: "일상 생존 표현 625단어",
    sessions: 125,
    units: 625,
    unitLabel: "단어",
    status: "active",
    productHref: "/products/deutsch-a1",
  },
  {
    level: "A2",
    label: "A2 · 초급",
    slug: "a2",
    href: "/languages/de/a2",
    description: "Goethe-Zertifikat A2 기준",
    detail: "일상 대화, 간단한 의사표현 547단어",
    sessions: 110,
    units: 547,
    unitLabel: "단어",
    status: "active",
    productHref: "/products/deutsch-a2",
  },
  {
    level: "B1",
    label: "B1 · 중급",
    slug: "b1",
    href: "/languages/de/b1",
    description: "Goethe-Zertifikat B1 기준",
    detail: "자립적 의사소통, 시험 대비 1,160단어",
    sessions: 232,
    units: 1160,
    unitLabel: "단어",
    status: "active",
    productHref: "/products/deutsch-b1",
  },
  {
    level: "B2",
    label: "B2 · 중상급",
    slug: "b2",
    href: "/languages/de/b2",
    description: "Goethe-Zertifikat B2 기준",
    detail: "복잡한 주제 토론, 전문적 의사소통",
    sessions: null,
    units: null,
    unitLabel: null,
    status: "coming_soon",
    productHref: null,
  },
];

const levelColors: Record<string, string> = {
  ABC: "bg-gray-100 border-gray-300",
  A1: "bg-green-50 border-green-300",
  A2: "bg-yellow-50 border-yellow-300",
  B1: "bg-orange-50 border-orange-300",
  B2: "bg-gray-50 border-gray-200",
};

export const meta = () => [
  { title: "독일어 로드맵 — Nudge" },
  {
    name: "description",
    content: "독일어 ABC부터 B1까지 단계별 학습 로드맵. Goethe-Institut 공인 어휘 기준.",
  },
];

export default function DeRoadmapPage() {
  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      {/* Hero */}
      <div className="border-b border-gray-200 bg-white px-6 py-16 md:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 text-5xl">🇩🇪</div>
          <h1 className="mb-3 text-4xl font-black text-gray-900 md:text-5xl">독일어</h1>
          <p className="mb-2 text-2xl font-bold text-gray-800">Deutsch lernen.</p>
          <p className="mb-6 text-lg leading-relaxed text-gray-600">
            보고, 듣고, 따라하세요.
            <br />
            머릿속에 우겨넣는 게 전략입니다.
          </p>
          <p className="mb-8 max-w-xl text-sm leading-relaxed text-gray-500">
            앱 없이. 교재 없이. 알림 하나로 시작하는 독일어 단어 학습.
            <br />
            Goethe-Institut 공인 어휘 기준 ABC부터 B1까지.
          </p>
          <Link
            to="/languages/de/abc"
            className="inline-flex items-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
          >
            독일어 ABC 시작하기 →
          </Link>
        </div>
      </div>

      {/* Roadmap Cards */}
      <div className="mx-auto max-w-3xl px-6 py-12 md:px-10">
        <h2 className="mb-8 text-2xl font-black text-gray-900">독일어 학습 로드맵</h2>
        <div className="space-y-4">
          {roadmapItems.map((item) => {
            const isComingSoon = item.status === "coming_soon";
            const colorClass = levelColors[item.level] ?? "bg-gray-50 border-gray-200";
            const className = `block rounded-xl border-2 p-5 transition-colors ${colorClass} ${
              isComingSoon ? "pointer-events-none opacity-60" : "hover:border-gray-500"
            }`;
            const cardContent = (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-lg font-black text-gray-900">{item.level}</span>
                      <span className="text-sm text-gray-600">{item.label}</span>
                      {isComingSoon && (
                        <span className="rounded-full bg-gray-400 px-2 py-0.5 text-xs font-medium text-white">
                          준비 중
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-700">{item.description}</p>
                    <p className="text-sm text-gray-500">{item.detail}</p>
                  </div>
                  {item.units !== null && (
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-black text-gray-900">
                        {item.units.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">{item.unitLabel}</div>
                    </div>
                  )}
                </div>
                {item.sessions !== null && (
                  <div className="mt-3 text-xs text-gray-500">{item.sessions}세션</div>
                )}
              </>
            );

            return isComingSoon ? (
              <div key={item.level} className={className}>
                {cardContent}
              </div>
            ) : (
              <Link key={item.level} to={item.href} className={className}>
                {cardContent}
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
              { step: "①", title: "보세요", desc: "단어가 뜨면 눈으로 읽습니다." },
              { step: "②", title: "들으세요", desc: "TTS가 원어민 발음으로 읽어줍니다." },
              { step: "③", title: "따라하세요", desc: "소리를 따라 입으로 따라합니다." },
            ].map((s) => (
              <div key={s.step} className="rounded-xl bg-[#fdf8f0] p-5">
                <div
                  className="mb-2 text-xl font-black"
                  style={{ color: "#FFCE00" }}
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

      {/* 독일어 특징 */}
      <div className="px-6 py-12 md:px-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-2xl font-black text-gray-900">독일어, 이게 제일 어렵죠?</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: "🇩🇪",
                title: "der / die / das",
                desc: "관사 3개, Nudge는 단어와 관사를 세트로 외웁니다.",
              },
              {
                icon: "📏",
                title: "긴 합성어",
                desc: "A1은 일상 650단어뿐. 겁먹을 필요 없습니다.",
              },
              {
                icon: "🔁",
                title: "반복이 유일한 해법",
                desc: "단어를 먼저 쌓아야 문법도 보입니다.",
              },
            ].map((c) => (
              <div key={c.title} className="rounded-xl border border-gray-200 bg-white p-5">
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

      {/* Story Learning 크로스셀 */}
      <div className="border-t border-gray-200 bg-white px-6 py-12 md:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-sm text-gray-500">단어가 쌓이면, 이야기로 읽어보세요.</p>
          <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 p-6">
            <div className="mb-2 text-3xl">🏰</div>
            <div className="mb-1 text-lg font-black text-gray-900">스노우 화이트: 7개의 그림자</div>
            <div className="mb-4 text-sm text-gray-500">독일어 B1 단어로 쓴 동화 · 20챕터</div>
            <Link
              to="/products/story-deutsch-b1-snowwhite"
              className="text-sm font-semibold text-yellow-700 hover:text-yellow-900"
            >
              Story 학습 보기 →
            </Link>
          </div>
        </div>
      </div>

      {/* 마무리 CTA */}
      <div className="px-6 py-16 md:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-2 text-2xl font-black text-gray-900">Bereit? 준비됐나요?</h2>
          <p className="mb-8 text-gray-500">독일어 여정을 시작하세요.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/languages/de/abc"
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
