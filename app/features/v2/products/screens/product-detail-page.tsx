/**
 * /products/:slug
 *
 * Product detail page.
 *
 * Renders two layouts based on product type:
 *   - "story" (meta.story exists): chapter list, story-specific how-to
 *   - "word"  (default):           session word preview, word card how-to
 *
 * CTA buttons:
 *   "학습 시작" — branches based on auth + subscription state:
 *     - Not logged in          → /login?next=/products/:slug
 *     - Logged in + no sub     → /products/:slug/checkout
 *     - Logged in + subscribed → start-learning API → /sessions/:id
 *   "즉시 무료 체험" — goes directly to first stage (no login, no data saved)
 */
import type { Route } from "./+types/product-detail-page";

import { Link, useLoaderData, useFetcher } from "react-router";
import { useState, useEffect } from "react";

import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { getNv2ProductBySlug } from "~/features/v2/products/queries";
import { getNv2FirstStage } from "~/features/v2/stage/lib/queries.server";
import { getNv2FirstProductSession } from "~/features/v2/session/lib/queries.server";
import type { NV2ProductMeta } from "~/features/v2/products/schema";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = ({ matches }) => {
  const loader_data = matches.find(
    (m) => m?.id === "routes/products/:slug"
  )?.data as Awaited<ReturnType<typeof loader>> | undefined;

  return [
    { title: loader_data ? `${loader_data.product.name} — Nudge` : "Nudge" },
    {
      name: "description",
      content: loader_data?.product.description ?? "Nudge 학습 상품",
    },
  ];
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);

  const product = await getNv2ProductBySlug(client, { slug: params.slug });
  if (!product) throw new Response("Product not found", { status: 404 });

  const meta_obj = (product.meta && typeof product.meta === "object" && !Array.isArray(product.meta))
    ? (product.meta as Record<string, unknown>)
    : {};
  const is_story = !!meta_obj?.story;

  const first_stage = await getNv2FirstStage(client, product.id).catch(() => null);
  const first_product_session = await getNv2FirstProductSession(client, product.id).catch(() => null);

  const { data: { user } } = await client.auth.getUser();
  const is_authenticated = !!user;

  let is_subscribed = false;
  if (user) {
    const { data: sub } = await adminClient
      .from("nv2_subscriptions")
      .select("id")
      .eq("auth_user_id", user.id)
      .eq("product_id", product.id)
      .eq("is_active", true)
      .maybeSingle();
    is_subscribed = !!sub;
  }

  // Session count for stats
  const { count: session_count } = await adminClient
    .from("nv2_product_sessions")
    .select("id", { count: "exact", head: true })
    .eq("product_id", product.id)
    .eq("is_active", true);

  // Session preview list
  // - word product: first 5 sessions with word titles
  // - story product: all sessions (chapter list)
  let session_previews: Array<{
    session_number: number;
    title: string;
    word_titles: string[];
  }> = [];

  if (is_story) {
    // All chapters with title
    const { data: chapters } = await adminClient
      .from("nv2_product_sessions")
      .select("session_number, title")
      .eq("product_id", product.id)
      .eq("is_active", true)
      .order("session_number", { ascending: true });

    session_previews = (chapters ?? []).map((c) => ({
      session_number: c.session_number,
      title: c.title ?? `Chapter ${c.session_number}`,
      word_titles: [],
    }));
  } else {
    // First 5 sessions with learning stage titles (= words)
    const { data: sessions } = await adminClient
      .from("nv2_product_sessions")
      .select(`
        session_number, title,
        nv2_product_session_stages(
          display_order,
          nv2_stages!inner(title, stage_type)
        )
      `)
      .eq("product_id", product.id)
      .eq("is_active", true)
      .order("session_number", { ascending: true })
      .limit(5);

    session_previews = (sessions ?? []).map((s) => {
      const words = ((s.nv2_product_session_stages as any[]) ?? [])
        .filter((p: any) => p.nv2_stages?.stage_type === "learning")
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((p: any) => p.nv2_stages?.title ?? "")
        .filter(Boolean);
      return {
        session_number: s.session_number,
        title: s.title ?? `Session ${s.session_number}`,
        word_titles: words,
      };
    });
  }

  return {
    product: {
      ...product,
      price: (product as any).price ?? 0,
    },
    is_story,
    first_stage,
    first_product_session,
    is_authenticated,
    is_subscribed,
    session_count: session_count ?? 0,
    session_previews,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProductSubtitle(category: string, meta: NV2ProductMeta | null): string {
  const m = meta && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
  if (category === "language") {
    const lang = typeof m.language === "string" ? m.language.toUpperCase() : "";
    const level = typeof m.level === "string" ? m.level : "";
    return [lang, level].filter(Boolean).join(" · ");
  }
  if (category === "exam") return typeof m.exam_name === "string" ? m.exam_name : "";
  if (category === "medical") return typeof m.domain === "string" ? m.domain : "Medical";
  return "";
}

const CATEGORY_ICONS: Record<string, string> = {
  language: "📚", medical: "🩺", exam: "📝", business: "💼", general: "🎯",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProductDetailPage() {
  const {
    product, is_story,
    first_stage, first_product_session,
    is_authenticated, is_subscribed,
    session_count, session_previews,
  } = useLoaderData<typeof loader>();

  const icon = product.icon ?? CATEGORY_ICONS[product.category] ?? "📚";
  const subtitle = getProductSubtitle(product.category, product.meta as NV2ProductMeta | null);
  const meta_obj = (product.meta && typeof product.meta === "object" && !Array.isArray(product.meta))
    ? (product.meta as Record<string, unknown>)
    : {};

  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      {/* Back link */}
      <div className="border-b border-[#1a2744]/[0.07] bg-white/60 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl">
          <Link to="/products" className="text-sm font-semibold text-[#6b7a99] hover:text-[#1a2744]">
            ← 학습 상품
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-8 space-y-5">

        {/* ── Product header card ── */}
        <div className="rounded-3xl bg-white p-8 shadow-[0_4px_24px_rgba(26,39,68,0.08)]">
          <span className="mb-4 block text-5xl">{icon}</span>

          {subtitle && (
            <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-[#6b7a99]">
              {subtitle}
            </p>
          )}

          <h1 className="mb-3 font-display text-3xl font-black text-[#1a2744]">
            {product.name}
          </h1>

          {product.description && (
            <p className="mb-6 text-base leading-[1.8] text-[#6b7a99]">
              {product.description}
            </p>
          )}

          {/* Stats row */}
          <div className="mb-8 flex gap-8 border-t border-[#1a2744]/[0.06] pt-6">
            {is_story ? (
              <>
                <StatItem
                  value={String(session_count)}
                  unit="챕터"
                  label={typeof meta_obj.season === "number" ? `시즌 ${meta_obj.season}` : "전체"}
                />
                <StatItem value="5" unit="단어" label="챕터당 학습" />
              </>
            ) : (
              <>
                <StatItem
                  value={product.total_stages > 0 ? product.total_stages.toLocaleString() : String(session_count * 5)}
                  unit="개"
                  label="학습 단어"
                />
                <StatItem value={String(session_count)} unit="세션" label="전체 세션" />
              </>
            )}
            <StatItem
              value={product.price === 0 ? "0" : product.price.toLocaleString("ko-KR")}
              unit="원"
              label={product.price === 0 ? "무료" : "가격"}
            />
          </div>

          {/* CTA */}
          <CTASection
            product_slug={product.slug}
            first_stage={first_stage}
            first_product_session={first_product_session}
            is_authenticated={is_authenticated}
            is_subscribed={is_subscribed}
            is_story={is_story}
          />
        </div>

        {/* ── How it works ── */}
        <div className="rounded-3xl bg-white p-8 shadow-[0_4px_24px_rgba(26,39,68,0.08)]">
          <h2 className="mb-6 font-display text-lg font-black text-[#1a2744]">학습 방법</h2>
          {is_story ? <StoryHowTo /> : <WordHowTo />}
        </div>

        {/* ── Session / Chapter list ── */}
        {session_previews.length > 0 && (
          is_story
            ? <ChapterList chapters={session_previews} />
            : <SessionPreviewList sessions={session_previews} total={session_count} />
        )}

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatItem
// ---------------------------------------------------------------------------

function StatItem({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-black text-[#1a2744]">
        {value}<span className="text-[#4caf72]">{unit}</span>
      </div>
      <div className="mt-0.5 text-xs text-[#6b7a99]">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HowTo sections
// ---------------------------------------------------------------------------

function WordHowTo() {
  const steps = [
    { num: "01", title: "카드 열람", desc: "단어, 의미, 예문 카드를 순서대로 확인합니다." },
    { num: "02", title: "Self 평가", desc: "\"암기 완료\"를 누르면 다음 단계로 진행됩니다. 더 보고 싶으면 \"다시 보기\"를 눌러요." },
    { num: "03", title: "퀴즈 & 문장 연습", desc: "매 세션마다 퀴즈와 문장 만들기로 기억을 다집니다." },
    { num: "04", title: "자동 복습", desc: "+1일, +3일, +7일, +14일에 복습 알림이 발송됩니다." },
  ];
  return <HowToList steps={steps} />;
}

function StoryHowTo() {
  const steps = [
    { num: "01", title: "단어 먼저", desc: "챕터 시작 전 5개 단어를 카드로 미리 학습합니다." },
    { num: "02", title: "이야기 읽기", desc: "이야기를 읽다가 단어가 등장하면 클릭해서 뜻과 예문을 확인합니다." },
    { num: "03", title: "퀴즈로 마무리", desc: "챕터 끝에 퀴즈로 기억을 다져요." },
    { num: "04", title: "자동 복습", desc: "+1일, +3일, +7일, +14일에 복습 알림이 발송됩니다." },
  ];
  return <HowToList steps={steps} />;
}

function HowToList({ steps }: { steps: { num: string; title: string; desc: string }[] }) {
  return (
    <div className="space-y-4">
      {steps.map(({ num, title, desc }) => (
        <div key={num} className="flex gap-4">
          <div className="font-display text-2xl font-black leading-none text-[#4caf72]/30">{num}</div>
          <div>
            <h3 className="mb-1 font-display text-sm font-extrabold text-[#1a2744]">{title}</h3>
            <p className="text-sm leading-[1.7] text-[#6b7a99]">{desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chapter list (story)
// ---------------------------------------------------------------------------

function ChapterList({ chapters }: {
  chapters: Array<{ session_number: number; title: string; word_titles: string[] }>;
}) {
  const [expanded, set_expanded] = useState(false);
  const visible = expanded ? chapters : chapters.slice(0, 5);

  return (
    <div className="rounded-3xl bg-white shadow-[0_4px_24px_rgba(26,39,68,0.08)] overflow-hidden">
      <div className="px-8 pt-7 pb-4 border-b border-[#f4f6fb]">
        <h2 className="font-display text-lg font-black text-[#1a2744]">챕터 목록</h2>
        <p className="mt-1 text-xs text-[#9aa3b5]">전체 {chapters.length}챕터</p>
      </div>
      <div className="divide-y divide-[#f4f6fb]">
        {visible.map((ch) => {
          // Extract chapter title after ": " if present
          const display_title = ch.title.includes(": ")
            ? ch.title.split(": ").slice(1).join(": ")
            : ch.title;
          return (
            <div key={ch.session_number} className="flex items-center gap-4 px-8 py-4">
              <span className="w-10 shrink-0 font-display text-xs font-black text-[#c3c9d5]">
                Ch.{ch.session_number}
              </span>
              <span className="text-sm font-bold text-[#1a2744]">{display_title}</span>
            </div>
          );
        })}
      </div>
      {chapters.length > 5 && (
        <div className="px-8 py-4 text-center border-t border-[#f4f6fb]">
          <button
            onClick={() => set_expanded((v) => !v)}
            className="text-sm font-bold text-[#6b7a99] hover:text-[#1a2744] transition-colors"
          >
            {expanded ? "접기 ↑" : `더 보기 (${chapters.length - 5}개 남음) ↓`}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session preview list (word)
// ---------------------------------------------------------------------------

function SessionPreviewList({ sessions, total }: {
  sessions: Array<{ session_number: number; title: string; word_titles: string[] }>;
  total: number;
}) {
  return (
    <div className="rounded-3xl bg-white shadow-[0_4px_24px_rgba(26,39,68,0.08)] overflow-hidden">
      <div className="px-8 pt-7 pb-4 border-b border-[#f4f6fb]">
        <h2 className="font-display text-lg font-black text-[#1a2744]">학습 내용 미리보기</h2>
        <p className="mt-1 text-xs text-[#9aa3b5]">첫 5세션 · 전체 {total}세션</p>
      </div>
      <div className="divide-y divide-[#f4f6fb]">
        {sessions.map((s) => (
          <div key={s.session_number} className="px-8 py-4">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="w-16 shrink-0 font-display text-xs font-black text-[#c3c9d5]">
                Session {s.session_number}
              </span>
            </div>
            {s.word_titles.length > 0 && (
              <p className="text-xs leading-[1.7] text-[#6b7a99]">
                {s.word_titles.join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="px-8 py-4 text-center border-t border-[#f4f6fb]">
        <p className="text-xs text-[#c3c9d5]">구독 후 전체 세션 목록을 확인할 수 있어요</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CTASection (unchanged from original)
// ---------------------------------------------------------------------------

function CTASection({
  product_slug,
  first_stage,
  first_product_session,
  is_authenticated,
  is_subscribed,
  is_story,
}: {
  product_slug: string;
  first_stage: { id: string } | null;
  first_product_session: { id: string } | null;
  is_authenticated: boolean;
  is_subscribed: boolean;
  is_story: boolean;
}) {
  const [show_trial_modal, set_show_trial_modal] = useState(false);
  const fetcher = useFetcher<{ ok?: boolean; session_id?: string; error?: string }>();
  const is_loading = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.ok && fetcher.data.session_id) {
      window.location.href = `/sessions/${fetcher.data.session_id}`;
    }
  }, [fetcher.data]);

  // story: has content when first_product_session exists
  // word:  has content when first_stage (learning) exists
  const has_content = is_story ? !!first_product_session : !!first_stage;

  if (!has_content) {
    return (
      <div className="rounded-2xl bg-[#fdf8f0] px-5 py-4 text-center">
        <p className="text-sm font-bold text-[#6b7a99]">콘텐츠 준비 중이에요. 조금만 기다려주세요! 🛠️</p>
      </div>
    );
  }

  if (fetcher.data?.ok) {
    return (
      <div className="rounded-2xl bg-[#4caf72]/10 px-5 py-5 text-center">
        <div className="mb-1 text-2xl">⏳</div>
        <p className="font-bold text-[#1a2744]">세션 페이지로 이동 중...</p>
      </div>
    );
  }

  function handleStartLearning() {
    if (!is_authenticated) {
      window.location.href = `/login?next=${encodeURIComponent(`/products/${product_slug}`)}`;
      return;
    }
    if (!is_subscribed) {
      window.location.href = `/products/${product_slug}/checkout`;
      return;
    }
    fetcher.submit({}, { method: "POST", action: `/api/v2/products/${product_slug}/start` });
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleStartLearning}
        disabled={is_loading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#4caf72] py-4 text-base font-extrabold text-white shadow-[0_4px_16px_rgba(76,175,114,0.30)] transition-all hover:-translate-y-px hover:bg-[#5ecb87] disabled:opacity-60"
      >
        {is_loading ? "준비 중..." : is_subscribed ? "학습 시작 →" : is_authenticated ? "구매하고 학습 시작 →" : "로그인하고 학습 시작 →"}
      </button>

      <button
        onClick={() => set_show_trial_modal(true)}
        className="w-full rounded-2xl border border-[#e8ecf5] bg-white py-3.5 text-sm font-bold text-[#6b7a99] transition-all hover:border-[#d0d7e8] hover:text-[#1a2744]"
      >
        즉시 무료 체험
      </button>

      {fetcher.data?.error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-xs font-bold text-red-600 text-center">
          {fetcher.data.error}
        </p>
      )}

      {show_trial_modal && (
        <TrialModal
          product_slug={product_slug}
          onClose={() => set_show_trial_modal(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrialModal (unchanged from original)
// ---------------------------------------------------------------------------

function TrialModal({
  product_slug,
  onClose,
}: {
  product_slug: string;
  onClose: () => void;
}) {
  const fetcher = useFetcher<{ ok?: boolean; session_id?: string; error?: string }>();
  const is_loading = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.ok && fetcher.data.session_id) {
      window.location.href = `/sessions/${fetcher.data.session_id}`;
    }
  }, [fetcher.data]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-3xl text-center">✨</div>
        <h3 className="mb-2 text-center font-display text-xl font-black text-[#1a2744]">
          무료 체험
        </h3>
        <p className="mb-5 text-center text-sm leading-relaxed text-[#6b7a99]">
          로그인 없이 첫 번째 세션을 체험할 수 있어요.
          <br />
          <span className="font-bold text-[#f5a623]">학습 기록은 저장되지 않습니다.</span>
        </p>

        {fetcher.data?.error && (
          <p className="mb-3 text-center text-xs font-bold text-red-500">
            {fetcher.data.error}
          </p>
        )}

        <button
          onClick={() =>
            fetcher.submit(
              {},
              { method: "POST", action: `/api/v2/products/${product_slug}/trial` }
            )
          }
          disabled={is_loading}
          className="flex w-full items-center justify-center rounded-2xl bg-[#1a2744] py-3.5 text-sm font-extrabold text-white transition-all hover:bg-[#243358] disabled:opacity-60"
        >
          {is_loading ? "준비 중..." : "지금 바로 체험하기 →"}
        </button>

        <button
          onClick={onClose}
          className="mt-3 w-full rounded-2xl py-3 text-sm font-bold text-[#6b7a99] hover:text-[#1a2744]"
        >
          취소
        </button>
      </div>
    </div>
  );
}
