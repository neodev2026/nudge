/**
 * [v2 Home Page]
 *
 * Landing page for Nudge v2.
 * - Accessible by all users (no auth required)
 * - Displays service introduction, Leni character, and product list
 * - Discord CTA triggers the OAuth flow at /auth/discord/start
 *
 * Design reference: nudge-landing.html (HTML prototype)
 */
import type { Route } from "./+types/home-page";

import { Link, useLoaderData } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  description: string | null;
  language: string;
  level: string;
  is_active: boolean;
}

// ─── Meta ────────────────────────────────────────────────────────────────────

export const meta: Route.MetaFunction = () => [
  { title: "Nudge — 하루 20초 언어 학습" },
  {
    name: "description",
    content:
      "Discord 연결 하나로 시작하는 언어 학습. 가입 불필요. Leni가 매일 20초짜리 학습 카드를 보내드립니다.",
  },
];

// ─── Loader ──────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);

  // Fetch active learning products for the product showcase section
  const { data: products } = await client
    .from("learning_product")
    .select("id, name, description, language, level, is_active")
    .eq("is_active", true)
    .order("language")
    .order("level");

  return { products: products ?? [] };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HomePage({ loaderData }: Route.ComponentProps) {
  const { products } = loaderData;

  return (
    <div className="overflow-x-hidden">
      {/* German flag stripe */}
      <div className="h-[5px] bg-[linear-gradient(to_right,#000_33%,#dd0000_33%_66%,#ffce00_66%)]" />

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
        {/* background glows — section 전체에 걸쳐 표시 */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-[680px] w-[680px] rounded-full bg-[radial-gradient(circle,rgba(76,175,114,0.13)_0%,transparent_70%)]" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(245,166,35,0.10)_0%,transparent_70%)]" />

        {/* 콘텐츠 영역 — 가운데 정렬, 최대 너비 제한 */}
        <div className="relative z-10 mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 md:min-h-[calc(100vh-80px)] md:grid-cols-2 md:gap-8">

          {/* Left — 텍스트 */}
          <div className="animate-slide-up">
            {/* badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#1a2744] px-4 py-1.5">
              <span className="inline-block h-[7px] w-[7px] animate-pulse rounded-full bg-[#5ecb87]" />
              <span className="text-xs font-bold tracking-wide text-white">
                가입 없이 지금 바로 시작
              </span>
            </div>

            <h1 className="mb-5 font-display text-[clamp(2.6rem,4vw,3.6rem)] font-black leading-[1.1] text-[#1a2744]">
              하루{" "}
              <span className="text-[#4caf72]">20초</span>,<br />
              <span className="relative inline-block">
                잊을 틈
                <span className="absolute -bottom-1 left-0 right-0 h-[6px] rounded-sm bg-[#f5a623]/60" />
              </span>
              이 없습니다
            </h1>

            <p className="mb-8 max-w-[420px] text-[1.05rem] leading-[1.75] text-[#6b7a99]">
              Nudge는 SNS 알림으로 학습 카드를 보냅니다.<br />
              앱 설치도, 로그인도, 복잡한 설정도 필요 없어요.<br />
              Discord 연결 하나로 지금 바로 시작하세요.
            </p>

            {/* stats */}
            <div className="mb-10 flex gap-8">
              {[
                { num: "20", unit: "초", label: "카드 1장 학습 시간" },
                { num: "703", unit: "개", label: "영어 B1 단어" },
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

            {/* CTA */}
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

          {/* Right — Leni (모바일: 텍스트 아래 세로 배치, PC: 오른쪽 열) */}
          <div className="flex items-end justify-center md:h-[calc(100vh-80px)]">
            <div className="relative w-full max-w-[420px]">
              {/* speech bubbles */}
              <div className="absolute right-[-20px] top-[20%] z-20 animate-bubble-1 rounded-[18px_18px_18px_4px] bg-white px-4 py-2.5 shadow-[0_8px_32px_rgba(26,39,68,0.10)] md:right-[-30px]">
                <span className="font-display font-bold text-[#4caf72]">Guten Tag!</span>
                <span className="ml-1 inline-block rounded bg-[#1a2744] px-1.5 py-0.5 align-middle text-[0.68rem] font-black tracking-wide text-white">
                  B1
                </span>
              </div>
              <div className="absolute left-[-20px] top-[42%] z-20 animate-bubble-2 rounded-[18px_18px_4px_18px] bg-white px-4 py-2.5 shadow-[0_8px_32px_rgba(26,39,68,0.10)] md:left-[-40px]">
                <span className="text-sm font-bold text-[#1a2744]">오늘의 단어가 도착했어요 ✉️</span>
              </div>

              {/* Leni 이미지 */}
              <div
                className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#e8f5ee] to-[#f0e8d8]"
                style={{ animation: "leniFloat 5s ease-in-out infinite" }}
              >
                <img
                  src="/images/leni/leni-hero-nobg.png"
                  alt="Leni"
                  className="relative z-10 mx-auto block w-[90%] object-contain"
                />
              </div>

              {/* floating badges */}
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

        </div>{/* end 콘텐츠 grid */}
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
              desc: "Leni가 Discord로 학습 카드 링크를 보내드려요. 클릭하면 20초짜리 카드가 펼쳐집니다.",
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

          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
              {products.map((product, i) => (
                <Link
                  key={product.id}
                  to={`/products/${product.id}`}
                  className={[
                    "group relative overflow-hidden rounded-2xl border px-6 py-7 transition-all hover:-translate-y-1",
                    i === 0
                      ? "border-[#4caf72] bg-[#4caf72] hover:bg-[#5ecb87]"
                      : "border-white/10 bg-white/5 hover:border-[#5ecb87] hover:bg-white/10",
                  ].join(" ")}
                >
                  {i === 0 && (
                    <span className="absolute right-3 top-3 rounded bg-[#f5a623] px-2 py-0.5 text-[0.65rem] font-black text-[#1a2744]">
                      추천
                    </span>
                  )}
                  <span className="mb-4 block text-3xl">
                    {product.language === "en" ? "🇬🇧" : "🇩🇪"}
                  </span>
                  <div className="mb-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-white/50">
                    {product.language === "en" ? "English" : "Deutsch"}
                  </div>
                  <div className="mb-2 font-display text-2xl font-black text-white">{product.level}</div>
                  <p className="mb-4 line-clamp-2 text-xs leading-[1.6] text-white/55">{product.description}</p>
                  <span className="text-xs font-bold text-white/50 transition-colors group-hover:text-white">
                    시작하기 →
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            // Fallback when DB has no products yet (development)
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { lang: "en", level: "B1", desc: "직장인을 위한 핵심 703단어", featured: true },
                { lang: "en", level: "A1", desc: "900개 필수 기초 단어로 시작하세요." },
                { lang: "en", level: "A2", desc: "801개 단어로 자신감을 높이세요." },
                { lang: "de", level: "A1", desc: "독일어 입문. 생활 기초 단어부터." },
                { lang: "de", level: "B1", desc: "독일 이민 필수 레벨." },
              ].map(({ lang, level, desc, featured }, i) => (
                <div
                  key={`${lang}-${level}`}
                  className={[
                    "relative overflow-hidden rounded-2xl border px-6 py-7",
                    featured
                      ? "border-[#4caf72] bg-[#4caf72]"
                      : "border-white/10 bg-white/5",
                  ].join(" ")}
                >
                  {featured && (
                    <span className="absolute right-3 top-3 rounded bg-[#f5a623] px-2 py-0.5 text-[0.65rem] font-black text-[#1a2744]">
                      추천
                    </span>
                  )}
                  <span className="mb-4 block text-3xl">{lang === "en" ? "🇬🇧" : "🇩🇪"}</span>
                  <div className="mb-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-white/50">
                    {lang === "en" ? "English" : "Deutsch"}
                  </div>
                  <div className="mb-2 font-display text-2xl font-black text-white">{level}</div>
                  <p className="text-xs leading-[1.6] text-white/55">{desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── LENI SECTION ── */}
      <section id="leni" className="bg-[#fffdf9] px-10 py-24">
        <div className="mx-auto grid max-w-[1100px] grid-cols-1 items-center gap-16 md:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[2px] text-[#4caf72]">Meet Leni</p>
            <h2 className="mb-5 font-display text-[clamp(1.8rem,3vw,2.5rem)] font-black leading-snug text-[#1a2744]">
              당신의 학습 파트너,<br />Leni를 소개합니다
            </h2>
            <p className="mb-8 max-w-[520px] text-base leading-[1.8] text-[#6b7a99]">
              Leni는 Nudge의 학습 도우미예요. 매일 적절한 타이밍에 카드를 보내고,
              잊어버릴 것 같은 단어는 먼저 챙겨드립니다.
            </p>
            <div className="flex flex-col gap-4">
              {[
                {
                  icon: "⏰",
                  title: "망각 곡선 기반 복습",
                  desc: "암기 완료 후 +1일, +3일, +7일, +14일에 자동으로 복습 카드를 보내드려요.",
                },
                {
                  icon: "📊",
                  title: "5·10 단어 퀴즈",
                  desc: "5개, 10개 단어를 학습할 때마다 매칭 퀴즈로 기억을 점검해 드립니다.",
                },
                {
                  icon: "💬",
                  title: "응원 메시지",
                  desc: "오늘 아직 못 보셨나요? Leni가 먼저 챙겨드립니다. 부담은 없어요.",
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
          </div>

          {/* Learning card preview */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute -left-3 top-3 h-[340px] w-[300px] -rotate-[4deg] rounded-3xl bg-white opacity-50 shadow-[0_10px_40px_rgba(26,39,68,0.08)]" />
              <div className="absolute -right-3 top-2.5 h-[340px] w-[300px] rotate-[3deg] rounded-3xl bg-white opacity-35 shadow-[0_10px_40px_rgba(26,39,68,0.08)]" />
              <div className="relative z-10 w-[300px] rounded-3xl bg-white p-8 shadow-[0_20px_60px_rgba(26,39,68,0.14)]">
                <span className="mb-6 inline-block rounded-lg bg-[#1a2744] px-3 py-1 text-[0.68rem] font-black uppercase tracking-wide text-white">
                  English B1 · Stage 42
                </span>
                <div className="mb-2 font-display text-[2.2rem] font-black text-[#1a2744]">apparent</div>
                <div className="mb-6 text-sm italic text-[#6b7a99]">/əˈpær.ənt/ · adj.</div>
                <div className="mb-6 rounded-xl bg-[#fdf8f0] p-4 text-base font-bold text-[#1a2744]">
                  명백한, 분명한 / 겉으로 보이는
                </div>
                <p className="mb-6 text-xs leading-[1.6] text-[#6b7a99]">
                  "It was <strong className="text-[#1a2744]">apparent</strong> to everyone that the project was behind schedule."
                </p>
                <div className="flex gap-3">
                  <button className="flex-1 rounded-xl border-2 border-[#e8ecf5] bg-white py-2.5 text-sm font-extrabold text-[#6b7a99] transition-colors hover:border-[#1a2744] hover:text-[#1a2744]">
                    ↺ 다시 보기
                  </button>
                  <button className="flex-[1.5] rounded-xl bg-[#4caf72] py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#5ecb87]">
                    암기 완료 ✓
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ── */}
      <section className="px-10 py-24 text-center">
        <p className="mb-3 text-xs font-extrabold uppercase tracking-[2px] text-[#4caf72]">지금 시작</p>
        <h2 className="mb-4 font-display text-[clamp(1.8rem,3vw,2.5rem)] font-black leading-snug text-[#1a2744]">
          오늘부터 20초씩,<br />Leni와 함께 시작해요
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
        <strong className="text-white/70">Nudge</strong> · 하루 20초 언어 학습 서비스 · 가입 없이 시작하세요
      </footer>

      {/* Animations */}
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
        .animate-slide-up {
          animation: slideUp .8s ease both;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-bubble-1 {
          animation: bubblePop .6s cubic-bezier(.34,1.56,.64,1) 1s both;
        }
        .animate-bubble-2 {
          animation: bubblePop .6s cubic-bezier(.34,1.56,.64,1) 2.2s both;
        }
        .animate-float-1 {
          animation: floatBadge 5s ease-in-out .5s infinite;
        }
        .animate-float-2 {
          animation: floatBadge 5.5s ease-in-out 1.8s infinite;
        }
        .font-display {
          font-family: 'Nunito', 'Noto Sans KR', sans-serif;
        }
      `}</style>
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
