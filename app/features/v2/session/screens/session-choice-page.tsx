/**
 * /sessions/:sessionId
 *
 * Session choice page — user selects between self-directed list or Leni chat.
 * Displays review context banner when session_kind === "review".
 */
import { useLoaderData } from "react-router";
import { Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

export async function loader({ params }: LoaderFunctionArgs) {
  const { createClient } = await import("@supabase/supabase-js");
  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { sessionId } = params;
  if (!sessionId) throw new Response("Not Found", { status: 404 });

  // Load session row — includes session_kind and review_round
  const { data: session, error: sessionErr } = await adminClient
    .from("nv2_sessions")
    .select(
      `session_id,
       auth_user_id,
       session_kind,
       review_round,
       nv2_product_sessions!inner(
         title,
         session_number,
         nv2_learning_products!inner(name)
       )`
    )
    .eq("session_id", sessionId)
    .single();

  if (sessionErr || !session) throw new Response("Not Found", { status: 404 });

  const authUserId = (session as any).auth_user_id as string | null;

  let subscriptionTurns = 0;
  let chargedTurns = 0;

  if (authUserId) {
    try {
      const { data: balance } = await adminClient
        .from("nv2_turn_balance")
        .select("subscription_turns, charged_turns")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (balance) {
        subscriptionTurns = balance.subscription_turns ?? 0;
        chargedTurns = balance.charged_turns ?? 0;
      }
    } catch {
      // non-critical — render with 0 turns
    }
  }

  const ps = (session as any).nv2_product_sessions;

  return {
    sessionId,
    productName: ps?.nv2_learning_products?.name ?? "",
    sessionTitle: ps?.title ?? "",
    sessionNumber: ps?.session_number ?? null,
    sessionKind: (session as any).session_kind as "new" | "review",
    reviewRound: (session as any).review_round as number | null,
    subscriptionTurns,
    chargedTurns,
  };
}

export default function SessionChoicePage() {
  const {
    sessionId,
    productName,
    sessionTitle,
    sessionNumber,
    sessionKind,
    reviewRound,
    subscriptionTurns,
    chargedTurns,
  } = useLoaderData<typeof loader>();

  const totalTurns = subscriptionTurns + chargedTurns;
  const is_review = sessionKind === "review";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <button
            onClick={() => window.history.back()}
            className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0"
            aria-label="뒤로 가기"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 3L5 7l4 4" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 truncate">
              {productName}{sessionNumber != null ? ` · Session ${sessionNumber}` : ""}
            </p>
            <p className="text-sm font-medium text-gray-900 truncate">{sessionTitle}</p>
          </div>
        </div>

        {/* Review context banner */}
        {is_review && (
          <div className="mx-4 mt-4 rounded-2xl bg-[#5865f2]/8 border border-[#5865f2]/20 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🔁</span>
              <div>
                <p className="text-sm font-extrabold text-[#5865f2]">
                  복습 {reviewRound != null ? `${reviewRound}회차` : ""}
                </p>
                <p className="text-xs text-[#6b7a99] mt-0.5">
                  이전에 배운 단어를 다시 확인해봐요. 반복이 기억을 만들어요 💪
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Page title */}
        <div className="px-4 pt-5 pb-1">
          <h1 className="text-lg font-medium text-gray-900">학습 방법 선택</h1>
          <p className="text-sm text-gray-500 mt-1">
            {is_review
              ? "어떻게 복습할까요?"
              : "오늘은 어떻게 공부할까요?"}
          </p>
        </div>

        {/* Banners */}
        <div className="flex flex-col gap-3 px-4 pt-4 pb-8 flex-1">

          {/* Banner A: 학습 목록 */}
          <BannerCard
            imageSrc="/images/leni/leni-study.jpg"
            badge={{ label: "자기주도", className: "bg-blue-50 text-blue-600" }}
            title="학습 목록"
            description={
              is_review
                ? <>카드를 다시 보고 퀴즈, 받아쓰기, 작문까지<br />내 페이스로 직접 복습해요.</>
                : <>카드 학습부터 퀴즈, 받아쓰기, 작문까지<br />내 페이스로 직접 진행해요.</>
            }
            cta={
              <Link
                to={`/sessions/${sessionId}/list`}
                className="block w-full py-2.5 text-center text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
              >
                {is_review ? "복습 목록으로 →" : "학습 목록으로 →"}
              </Link>
            }
          />

          {/* Banner B: Leni와 학습 */}
          <BannerCard
            imageSrc="/images/leni/leni-chat.jpg"
            badge={{ label: "AI 튜터", className: "bg-amber-50 text-amber-600" }}
            title="Leni와 학습"
            description={
              is_review
                ? <>Leni가 기억나는지 먼저 물어보고,<br />틀린 것만 집중적으로 다시 알려줘요.</>
                : <>Leni가 카드를 보여주고, 퀴즈도 내주고,<br />대화로 실력을 확인해줘요.</>
            }
            cta={
              <>
                <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-3 flex items-center gap-4">
                  <TurnStat label="월정기권" value={subscriptionTurns} />
                  <div className="w-px h-6 bg-gray-200" />
                  <TurnStat label="충전권" value={chargedTurns} />
                  <div className="flex-1 text-right">
                    {totalTurns > 0
                      ? <p className="text-xs text-gray-400">총 {totalTurns}턴 남음</p>
                      : <p className="text-xs text-amber-500 font-medium">턴이 없어요</p>
                    }
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  베타 기간 중 관리자가 무료로 충전해 드리고 있어요.
                </p>
                <Link
                  to={`/sessions/${sessionId}/chat`}
                  className="block w-full py-2.5 text-center text-sm font-medium text-gray-800 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  {is_review ? "Leni와 복습 시작 →" : "Leni와 학습 시작 →"}
                </Link>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BannerCard({
  imageSrc, badge, title, description, cta,
}: {
  imageSrc: string;
  badge: { label: string; className: string };
  title: string;
  description: React.ReactNode;
  cta: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-white">
      <div className="h-40">
        <img src={imageSrc} alt="" className="w-full h-full object-cover" />
      </div>
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base font-medium text-gray-900">{title}</span>
          <span className={`text-xs px-2 py-0.5 rounded ${badge.className}`}>{badge.label}</span>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed mb-3">{description}</p>
        {cta}
      </div>
    </div>
  );
}

function TurnStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">
        {value}<span className="text-xs font-normal text-gray-400 ml-0.5">턴</span>
      </p>
    </div>
  );
}
