/**
 * [v2 Home Page]
 *
 * Landing page for Nudge v2.
 * - Accessible by all users (no auth required)
 * - Fetches active products from nv2_learning_products table
 * - Discord CTA triggers the OAuth flow at /auth/discord/start
 */
import type { Route } from "./+types/home-page";

import { Link, useLoaderData } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import { getNv2ActiveProducts } from "~/features/v2/products/queries";

// ─── Types ───────────────────────────────────────────────────────────────────

type Product = {
  id: string;
  category: "language" | "medical" | "exam" | "business" | "general";
  name: string;
  description: string | null;
  slug: string;
  icon: string | null;
  meta: unknown | null;
  total_stages: number;
  display_order: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fallback icon per category when product.icon is not set */
const CATEGORY_ICONS: Record<string, string> = {
  language: "📚",
  medical:  "🩺",
  exam:     "📝",
  business: "💼",
  general:  "🎯",
};

/**
 * Extracts a short display label from product.meta for the card subtitle.
 * Language: "EN · B1"   Medical: "Terminology"   Exam: "정보처리기사"
 */
function getProductSubtitle(product: Product): string {
  const m =
    product.meta && typeof product.meta === "object" && !Array.isArray(product.meta)
      ? (product.meta as Record<string, unknown>)
      : {};
  if (product.category === "language") {
    const lang = typeof m.language === "string" ? m.language.toUpperCase() : "";
    const level = typeof m.level === "string" ? m.level : "";
    return [lang, level].filter(Boolean).join(" · ");
  }
  if (product.category === "exam") {
    return typeof m.exam_name === "string" ? m.exam_name : "";
  }
  if (product.category === "medical") {
    return typeof m.domain === "string" ? m.domain : "Medical";
  }
  return "";
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export const meta: Route.MetaFunction = () => [
  { title: "Nudge — 알림 하나로 시작하는 오늘의 학습" },
  {
    name: "description",
    content:
      "SNS 알림 하나로 시작하는 오늘의 학습. 가입 불필요. Leni가 매일 학습 링크를 보내드립니다.",
  },
];

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  const products = await getNv2ActiveProducts(client);
  return { products };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const { products } = useLoaderData<typeof loader>();

  return (
    <div className="overflow-x-hidden">
      {/* German flag stripe */}
      <div className="h-[5px] bg-[linear-gradient(to_right,#000_33%,#dd0000_33%_66%,#ffce00_66%)]" />

      {/* ── BETA NOTICE BANNER ── */}
      <div className="bg-[#f5a623]/10 border-b border-[#f5a623]/20 px-6 py-2.5 text-center">
        <p className="text-xs leading-relaxed text-[#6b7a99]">
          <span className="mr-2 inline-block rounded-full bg-[#f5a623] px-2 py-0.5 text-[0.65rem] font-black text-white">BETA</span>
          현재 베타 서비스 중입니다. 서비스 개선 과정에서 데이터가 초기화되거나 기능이 변경될 수 있으며,
          학습 데이터는 서비스 품질 향상에 활용될 수 있습니다.
        </p>
      </div>

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#1a2744]/[0.07] bg-[#fdf8f0]/85 px-10 backdrop-blur-xl">
        <span className="font-display text-2xl font-black tracking-tight text-[#1a2744]">
          Nudge<span className="text-[#4caf72]">.</span>
        </span>
        <ul className="hidden gap-8 md:flex">
          {[
            { href: "#how", label: "어떻게 하나요" },
            { href: "#products", label: "학습 상품" },
            { href: "#leni", label: "Leni 소개" },
            { href: "#roadmap", label: "로드맵" },
          ].map(({ href, label }) => (
            <li key={href}>
              <a
                href={href}
                className="text-sm font-semibold text-[#6b7a99] transition-colors hover:text-[#1a2744]"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
        <Link
          to="/auth/discord/start"
          className="rounded-full bg-[#1a2744] px-5 py-2 text-sm font-extrabold text-white transition-all hover:-translate-y-px hover:bg-[#243358]"
        >
          무료로 시작하기
        </Link>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-[calc(100vh-64px)] overflow-hidden px-6 pb-0 pt-8 md:px-10">
        {/* Background glows */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-[680px] w-[680px] rounded-full bg-[radial-gradient(circle,rgba(76,175,114,0.13)_0%,transparent_70%)]" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(245,166,35,0.10)_0%,transparent_70%)]" />

        {/* Content grid — centered with max-width */}
        <div className="relative z-10 mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 md:min-h-[calc(100vh-80px)] md:grid-cols-2 md:gap-8">

          {/* Left — copy */}
          <div className="animate-slide-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#1a2744] px-4 py-1.5">
              <span className="inline-block h-[7px] w-[7px] animate-pulse rounded-full bg-[#5ecb87]" />
              <span className="text-xs font-bold tracking-wide text-white">
                가입 없이 지금 바로 시작
              </span>
            </div>

            <h1 className="mb-5 font-display text-[clamp(2.6rem,4vw,3.6rem)] font-black leading-[1.1] text-[#1a2744]">
              <span className="text-[#4caf72]">알림 하나</span>로<br />
              시작하는{" "}
              <span className="relative inline-block">
                오늘의 학습
                <span className="absolute -bottom-1 left-0 right-0 h-[6px] rounded-sm bg-[#f5a623]/60" />
              </span>
            </h1>

            <p className="mb-8 max-w-[420px] text-[1.05rem] leading-[1.75] text-[#6b7a99]">
              Nudge는 SNS 알림으로 오늘의 학습 링크를 보냅니다.<br />
              앱 설치도, 로그인도, 복잡한 설정도 필요 없어요.<br />
              Discord 연결 하나로 지금 바로 시작하세요.
            </p>

            <div className="mb-10 flex gap-8">
              {[
                { num: "3", unit: "개", label: "지원 언어" },
                { num: "1,200", unit: "개+", label: "학습 콘텐츠" },
                { num: "0", unit: "원", label: "무료 시작" },
              ].map(({ num, unit, label }) => (
                <div key={label}>
                  <div className="font-display text-[1.8rem] font-black leading-none text-[#1a2744]">
                    {num}
                    <span className="text-[#4caf72]">{unit}</span>
                  </div>
                  <div className="mt-1 text-xs text-[#6b7a99]">{label}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/auth/discord/start"
                className="inline-flex items-center gap-2 rounded-full bg-[#5865F2] px-7 py-3.5 text-[0.95rem] font-extrabold text-white shadow-[0_4px_20px_rgba(88,101,242,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(88,101,242,0.45)]"
              >
                <DiscordIcon />
                Discord로 무료 시작
              </Link>
              <span className="text-xs text-[#6b7a99]">
                이미 <strong className="text-[#1a2744]">가입 불필요</strong> — Discord만 있으면 OK
              </span>
            </div>
          </div>

          {/* Right — Leni character (stacks below on mobile) */}
          <div className="flex items-end justify-center md:h-[calc(100vh-80px)]">
            <div className="relative w-full max-w-[420px]">
              {/* Speech bubbles */}
              <div className="absolute right-[-20px] top-[20%] z-20 animate-bubble-1 rounded-[18px_18px_18px_4px] bg-white px-4 py-2.5 shadow-[0_8px_32px_rgba(26,39,68,0.10)] md:right-[-30px]">
                <span className="font-display font-bold text-[#4caf72]">Guten Tag!</span>
                <span className="ml-1 inline-block rounded bg-[#1a2744] px-1.5 py-0.5 align-middle text-[0.68rem] font-black tracking-wide text-white">
                  B1
                </span>
              </div>
              <div className="absolute left-[-20px] top-[42%] z-20 animate-bubble-2 rounded-[18px_18px_4px_18px] bg-white px-4 py-2.5 shadow-[0_8px_32px_rgba(26,39,68,0.10)] md:left-[-40px]">
                <span className="text-sm font-bold text-[#1a2744]">오늘의 단어가 도착했어요 ✉️</span>
              </div>

              {/* Leni image — PNG with transparent background */}
              <div
                className="relative"
                style={{ animation: "leniFloat 5s ease-in-out infinite" }}
              >
                <img
                  src="/images/leni/leni-hero.png"
                  alt="Leni"
                  className="mx-auto block w-full object-contain drop-shadow-[0_20px_60px_rgba(26,39,68,0.15)]"
                />
              </div>

              {/* Floating badges */}
              <div className="absolute bottom-[28%] right-[-20px] animate-float-1 rounded-xl bg-white px-3.5 py-2.5 shadow-[0_8px_32px_rgba(26,39,68,0.10)] md:right-[-50px]">
                <span className="mr-1.5 text-lg">⚡</span>
                <span className="text-sm font-bold text-[#1a2744]">암기 완료!</span>
              </div>
              <div className="absolute bottom-[12%] left-[-20px] animate-float-2 rounded-xl bg-white px-3.5 py-2.5 shadow-[0_8px_32px_rgba(26,39,68,0.10)] md:left-[-60px]">
                <span className="mr-1.5 text-lg">🔔</span>
                <span className="text-sm font-bold text-[#1a2744]">다음 카드 발송됨</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="mx-auto max-w-[1100px] px-10 py-24">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[2px] text-[#4caf72]">How it works</p>
        <h2 className="mb-4 font-display text-[clamp(1.8rem,3vw,2.5rem)] font-black leading-snug text-[#1a2744]">
          세 단계면 끝납니다
        </h2>
        <p className="mb-12 max-w-[520px] text-base leading-[1.8] text-[#6b7a99]">
          복잡한 설정, 앱 설치, 매일 열어봐야 하는 의무 없음. 알림만 확인하세요.
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              num: "01", icon: "🔗",
              title: "Discord 연결",
              desc: "버튼 하나로 Discord 계정을 연결하세요. 회원가입도, 비밀번호도 필요 없습니다.",
            },
            {
              num: "02", icon: "📬",
              title: "학습 카드 수신",
              desc: "Leni가 Discord로 오늘의 학습 링크를 보내드려요. 링크 하나만 클릭하면 바로 시작됩니다.",
            },
            {
              num: "03", icon: "✅",
              title: "Self 평가 후 자동 반복",
              desc: '"암기 완료"를 누르면 다음 카드가 발송됩니다. 망각 곡선에 맞춰 자동으로 복습됩니다.',
            },
          ].map(({ num, icon, title, desc }) => (
            <div
              key={num}
              className="rounded-2xl bg-white p-8 shadow-[0_8px_32px_rgba(26,39,68,0.10)] transition-transform hover:-translate-y-1.5"
            >
              <div className="mb-4 font-display text-5xl font-black leading-none text-[#4caf72]/20">{num}</div>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf8f0] text-2xl">{icon}</div>
              <h3 className="mb-2 font-display text-lg font-extrabold text-[#1a2744]">{title}</h3>
              <p className="text-sm leading-[1.7] text-[#6b7a99]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRODUCTS ── */}
      <section id="products" className="bg-[#1a2744] px-10 py-24">
        <div className="mx-auto max-w-[1100px]">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[2px] text-[#5ecb87]">학습 상품</p>
          <h2 className="mb-4 font-display text-[clamp(1.8rem,3vw,2.5rem)] font-black leading-snug text-white">
            지금 바로 시작할 수 있어요
          </h2>
          <p className="mb-12 max-w-[520px] text-base leading-[1.8] text-white/60">
            가입 없이 Discord 연결만으로 학습을 시작할 수 있습니다.
          </p>

          <ProductGrid products={products} />
        </div>
      </section>

      {/* ── LENI SECTION ── */}
      <section id="leni" className="bg-[#fffdf9] px-10 py-24">
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 items-center gap-16 md:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[2px] text-[#4caf72]">Meet Leni</p>
            <h2 className="mb-5 font-display text-[clamp(1.8rem,3vw,2.5rem)] font-black leading-snug text-[#1a2744]">
              안녕, 나는 Leni야! 👋
            </h2>
            <p className="mb-3 text-base leading-[1.85] text-[#6b7a99]">
              나는 독일에서 온 15살 소녀예요. 영어, 한국어, 일본어... 배우고 싶은 게
              너무 많은데 외우는 건 정말 자신 없어요 😅
            </p>
            <p className="mb-8 text-base leading-[1.85] text-[#6b7a99]">
              그래서 나도 Nudge로 매일 조금씩 공부하고 있어요!
              여러분의 학습 알림을 대신 보내드리면서, 저도 함께 열심히 할게요. 🌟
            </p>
            <div className="flex flex-col gap-4">
              {[
                {
                  icon: "📬",
                  title: "매일 학습 알림 발송",
                  desc: "적절한 타이밍에 오늘의 학습 링크를 Discord로 보내드려요. 링크 하나만 클릭하면 됩니다.",
                },
                {
                  icon: "🔄",
                  title: "망각 곡선 기반 복습",
                  desc: "학습 완료 후 +1일, +3일, +7일, +14일에 자동으로 복습 알림을 보내드려요.",
                },
                {
                  icon: "🎯",
                  title: "퀴즈와 문장 연습",
                  desc: "단어만 외우면 지루하잖아요. 매칭 퀴즈와 문장 만들기로 기억을 단단하게 다져드려요.",
                },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4 rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(26,39,68,0.06)]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fdf8f0] text-lg">{icon}</div>
                  <div>
                    <h4 className="mb-1 font-display text-[0.9rem] font-extrabold text-[#1a2744]">{title}</h4>
                    <p className="text-sm leading-[1.6] text-[#6b7a99]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-[0.72rem] text-[#6b7a99]/60">
              * Leni 캐릭터 이미지는 SeaArt AI로 직접 제작한 오리지널 캐릭터입니다.
            </p>
          </div>

          {/* Leni animated character */}
          <div className="flex items-center justify-center">
            <div
              className="relative"
              style={{ animation: "leniFloat 5s ease-in-out infinite" }}
            >
              <img
                src="/images/leni/leni-hero-ani.gif"
                alt="Leni — Nudge 학습 파트너"
                className="mx-auto block w-full max-w-[360px] object-contain drop-shadow-[0_20px_60px_rgba(26,39,68,0.15)]"
              />
            </div>
          </div>
        </div>
      </section>


      {/* ── ROADMAP ── */}
      <section id="roadmap" className="mx-auto max-w-[1100px] px-10 py-24">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[2px] text-[#4caf72]">Roadmap</p>
        <h2 className="mb-4 font-display text-[clamp(1.8rem,3vw,2.5rem)] font-black leading-snug text-[#1a2744]">
          Nudge는 계속 성장합니다
        </h2>
        <p className="mb-12 max-w-[520px] text-base leading-[1.8] text-[#6b7a99]">
          지금은 시작입니다. 더 많은 학습 상품, 더 똑똑한 학습 방법,
          그리고 새로운 파트너들이 찾아올 예정이에요.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: "📚",
              title: "다양한 학습 상품 확대",
              desc: "언어뿐 아니라 자격증, 상식, 전문 용어 등 다양한 카테고리의 학습 콘텐츠가 추가됩니다.",
              status: "예정",
            },
            {
              icon: "🧩",
              title: "새로운 학습 방식 추가",
              desc: "플래시카드, O/X 퀴즈, 문장 완성 외에도 더 재미있고 효과적인 학습 방식을 준비하고 있어요.",
              status: "예정",
            },
            {
              icon: "🤝",
              title: "새로운 학습 파트너 추가",
              desc: "Leni 외에도 다양한 개성을 가진 학습 도우미 캐릭터들이 등장할 예정이에요.",
              status: "예정",
            },
            {
              icon: "💬",
              title: "카카오톡 · 텔레그램 지원",
              desc: "Discord 외에도 카카오톡, 텔레그램 등 더 많은 SNS 채널로 학습 알림을 받을 수 있게 됩니다.",
              status: "예정",
            },
            {
              icon: "📊",
              title: "학습 통계 및 진도 리포트",
              desc: "얼마나 학습했는지, 어떤 항목이 약한지 한눈에 볼 수 있는 대시보드가 생깁니다.",
              status: "예정",
            },
            {
              icon: "📱",
              title: "모바일 앱 출시",
              desc: "알림을 더 편리하게 받고, 어디서든 빠르게 학습할 수 있는 네이티브 앱을 준비하고 있어요.",
              status: "예정",
            },
          ].map(({ icon, title, desc, status }) => (
            <div
              key={title}
              className="rounded-2xl border border-[#e8ecf5] bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(26,39,68,0.10)]"
            >
              <div className="mb-4 flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fdf8f0] text-2xl">
                  {icon}
                </span>
                <span className="rounded-full bg-[#e8ecf5] px-2.5 py-1 text-[0.65rem] font-black tracking-wide text-[#6b7a99]">
                  {status}
                </span>
              </div>
              <h3 className="mb-2 font-display text-base font-extrabold text-[#1a2744]">{title}</h3>
              <p className="text-sm leading-[1.7] text-[#6b7a99]">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <section className="px-10 py-24 text-center">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[2px] text-[#4caf72]">지금 시작</p>
        <h2 className="mb-4 font-display text-[clamp(1.8rem,3vw,2.5rem)] font-black leading-snug text-[#1a2744]">
          알림 하나로,<br />Leni와 함께 시작해요
        </h2>
        <p className="mx-auto mb-10 max-w-[520px] text-base leading-[1.8] text-[#6b7a99]">
          회원가입 없이 Discord 연결만으로 바로 시작할 수 있습니다.
          첫 번째 단어 카드가 1분 안에 도착해요.
        </p>
        <Link
          to="/auth/discord/start"
          className="inline-flex items-center gap-2 rounded-full bg-[#5865F2] px-8 py-4 text-base font-extrabold text-white shadow-[0_4px_20px_rgba(88,101,242,0.35)] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(88,101,242,0.45)]"
        >
          <DiscordIcon />
          Discord로 무료 시작
        </Link>
      </section>

      <footer className="bg-[#1a2744] py-8 text-center text-sm text-white/40">
        <strong className="text-white/70">Nudge</strong> · 알림 하나로 시작하는 오늘의 학습 · 가입 없이 시작하세요
      </footer>

      {/* Animation keyframes */}
      <style>{`
        @keyframes leniFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-16px) rotate(0.8deg); }
        }
        @keyframes bubblePop {
          from { opacity: 0; transform: scale(.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes floatBadge {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .animate-slide-up { animation: slideUp .8s ease both; }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-bubble-1 { animation: bubblePop .6s cubic-bezier(.34,1.56,.64,1) 1s both; }
        .animate-bubble-2 { animation: bubblePop .6s cubic-bezier(.34,1.56,.64,1) 2.2s both; }
        .animate-float-1  { animation: floatBadge 5s ease-in-out .5s infinite; }
        .animate-float-2  { animation: floatBadge 5.5s ease-in-out 1.8s infinite; }
        .font-display { font-family: 'Nunito', 'Noto Sans KR', sans-serif; }
      `}</style>
    </div>
  );
}

// ─── Product Grid ─────────────────────────────────────────────────────────────

/**
 * Renders the product showcase grid.
 * Shows real DB products when available; falls back to placeholder cards during development.
 */
function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <ProductGridEmpty />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} featured={i === 0} />
      ))}
    </div>
  );
}

function ProductCard({
  product,
  featured,
}: {
  product: Product;
  featured: boolean;
}) {
  const icon = product.icon ?? CATEGORY_ICONS[product.category] ?? "📚";
  const subtitle = getProductSubtitle(product);

  return (
    <Link
      to={`/products/${product.slug}`}
      className={[
        "group relative overflow-hidden rounded-2xl border px-6 py-7 transition-all hover:-translate-y-1",
        featured
          ? "border-[#4caf72] bg-[#4caf72] hover:bg-[#5ecb87]"
          : "border-white/10 bg-white/5 hover:border-[#5ecb87] hover:bg-white/10",
      ].join(" ")}
    >
      {/* Featured badge */}
      {featured && (
        <span className="absolute right-3 top-3 rounded bg-[#f5a623] px-2 py-0.5 text-[0.65rem] font-black text-[#1a2744]">
          추천
        </span>
      )}

      {/* Icon (emoji or flag) */}
      <span className="mb-4 block text-3xl">{icon}</span>

      {/* Category subtitle — language: "EN · B1", exam: "정보처리기사" */}
      {subtitle && (
        <div className="mb-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-white/50">
          {subtitle}
        </div>
      )}

      {/* Product name */}
      <div className="mb-2 font-display text-lg font-black leading-tight text-white">
        {product.name}
      </div>

      {/* Description */}
      {product.description && (
        <p className="mb-4 line-clamp-2 text-xs leading-[1.6] text-white/55">
          {product.description}
        </p>
      )}

      {/* Stage count */}
      {product.total_stages > 0 && (
        <p className="mb-3 text-[0.65rem] text-white/40">
          {product.total_stages.toLocaleString()}개 항목
        </p>
      )}

      <span className="text-xs font-bold text-white/50 transition-colors group-hover:text-white">
        시작하기 →
      </span>
    </Link>
  );
}

/**
 * Shown only when nv2_learning_products has no active rows yet (dev environment).
 * Mirrors the final product lineup as placeholder cards.
 */
function ProductGridEmpty() {
  const placeholders = [
    { icon: "🇬🇧", subtitle: "EN · B1", name: "English B1", desc: "직장인을 위한 핵심 703단어", featured: true },
    { icon: "🇬🇧", subtitle: "EN · A1", name: "English A1", desc: "900개 필수 기초 단어로 시작하세요." },
    { icon: "🇬🇧", subtitle: "EN · A2", name: "English A2", desc: "801개 단어로 자신감을 높이세요." },
    { icon: "🇩🇪", subtitle: "DE · A1", name: "Deutsch A1", desc: "독일어 입문. 생활 기초 단어부터." },
    { icon: "🇩🇪", subtitle: "DE · B1", name: "Deutsch B1", desc: "독일 이민 필수 레벨." },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {placeholders.map(({ icon, subtitle, name, desc, featured }) => (
        <div
          key={name}
          className={[
            "relative overflow-hidden rounded-2xl border px-6 py-7",
            featured ? "border-[#4caf72] bg-[#4caf72]" : "border-white/10 bg-white/5",
          ].join(" ")}
        >
          {featured && (
            <span className="absolute right-3 top-3 rounded bg-[#f5a623] px-2 py-0.5 text-[0.65rem] font-black text-[#1a2744]">
              추천
            </span>
          )}
          <span className="mb-4 block text-3xl">{icon}</span>
          <div className="mb-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-white/50">
            {subtitle}
          </div>
          <div className="mb-2 font-display text-lg font-black leading-tight text-white">{name}</div>
          <p className="text-xs leading-[1.6] text-white/55">{desc}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.037.05a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
    </svg>
  );
}
