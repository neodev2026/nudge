/**
 * /sessions/:sessionId/story
 *
 * Story Session Page — orchestrates the full story session flow:
 *
 *   [Phase 0] Hook screen    — show hook_text, chapter title, "학습 시작" button
 *   [Phase 1] Learning cards — visit each learning stage via /stages/:id?session=...
 *                              (uses existing stage-page, redirects back here on complete)
 *   [Phase 2] Story typing   — /story/:stageId?session=... (existing story-page, modified)
 *   [Phase 3] Quiz           — /quiz/:stageId?session=... (existing quiz-page)
 *
 * Phase transitions are driven by URL query param:
 *   /sessions/:sessionId/story              → Phase 0 (hook)
 *   /sessions/:sessionId/story?phase=learn&idx=0  → Phase 1, stage index 0
 *   /sessions/:sessionId/story?phase=story  → Phase 2
 *   /sessions/:sessionId/story?phase=quiz   → Phase 3
 *
 * Auth: same as session-page (public link access supported).
 */
import { useLoaderData, Link, useNavigate } from "react-router";
import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StoryCardData = {
  chapter_number: number;
  chapter_title?: string;
  summary: string;
  hook_text?: string;
  text: string;
  illustration_url: string | null;
};

type StageInfo = {
  stage_id: string;
  stage_type: string;
  display_order: number;
};

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { createClient } = await import("@supabase/supabase-js");
  const adminClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [client] = makeServerClient(request);
  const { sessionId } = params;
  if (!sessionId) throw new Response("Not Found", { status: 404 });

  // Auth / link access check — use getSessionIdentity (same pattern as session-page)
  const { getSessionIdentity } = await import(
    "~/features/v2/session/lib/queries.server"
  );
  const identity = await getSessionIdentity(client, sessionId).catch(() => null);
  if (!identity) throw new Response("Not Found", { status: 404 });

  const { data: { user } } = await client.auth.getUser();
  if (identity.link_access === "members_only" && !user) {
    const next = encodeURIComponent(`/sessions/${sessionId}/story`);
    throw redirect(`/login?next=${next}`);
  }

  // Mark session as in_progress if pending
  if (identity.status === "pending") {
    await adminClient
      .from("nv2_sessions")
      .update({ status: "in_progress" })
      .eq("session_id", sessionId);
  }

  // Load product_session with stages (ordered)
  const { data: ps } = await adminClient
    .from("nv2_product_sessions")
    .select(`
      id, title, session_number,
      nv2_learning_products!inner(name, slug),
      nv2_product_session_stages(
        stage_id, display_order,
        nv2_stages!inner(id, stage_type, title, is_active)
      )
    `)
    .eq("id", identity.product_session_id)
    .maybeSingle();

  if (!ps) throw new Response("Product session not found", { status: 404 });

  const all_stages: StageInfo[] = ((ps.nv2_product_session_stages as any[]) ?? [])
    .filter((s: any) => s.nv2_stages?.is_active)
    .sort((a: any, b: any) => a.display_order - b.display_order)
    .map((s: any) => ({
      stage_id: s.stage_id,
      stage_type: s.nv2_stages?.stage_type ?? "",
      display_order: s.display_order,
    }));

  // Categorise stages
  const learning_stages = all_stages.filter(s => s.stage_type === "learning");
  const story_stage     = all_stages.find(s => s.stage_type === "story");
  const quiz_stage      = all_stages.find(
    s => s.stage_type === "quiz_current_session" || s.stage_type === "quiz_5"
  );

  // Load story card for hook_text
  let hook_text: string | null = null;
  let chapter_title: string | null = null;
  let illustration_url: string | null = null;

  if (story_stage) {
    const { data: story_card } = await adminClient
      .from("nv2_cards")
      .select("card_data")
      .eq("stage_id", story_stage.stage_id)
      .eq("card_type", "story")
      .maybeSingle();

    if (story_card?.card_data) {
      const d = story_card.card_data as StoryCardData;
      hook_text         = d.hook_text ?? null;
      chapter_title     = d.chapter_title ?? null;
      illustration_url  = d.illustration_url ?? null;
    }
  }

  const url        = new URL(request.url);
  const phase      = url.searchParams.get("phase") ?? "hook";
  const idx_str    = url.searchParams.get("idx") ?? "0";
  const stage_idx  = Math.max(0, parseInt(idx_str, 10) || 0);

  // Phase: learn — redirect directly to stage-page
  if (phase === "learn") {
    const target = learning_stages[stage_idx];
    if (!target) {
      // All learning done → go to story phase
      throw redirect(`/sessions/${sessionId}/story?phase=story`);
    }
    const next_url = encodeURIComponent(
      `/sessions/${sessionId}/story?phase=learn&idx=${stage_idx + 1}`
    );
    throw redirect(`/stages/${target.stage_id}?session=${sessionId}&next=${next_url}`);
  }

  // Phase: story — redirect to story-page
  if (phase === "story") {
    if (!story_stage) {
      throw redirect(`/sessions/${sessionId}/story?phase=quiz`);
    }
    const next_url = encodeURIComponent(
      `/sessions/${sessionId}/story?phase=quiz`
    );
    throw redirect(`/story/${story_stage.stage_id}?session=${sessionId}&next=${next_url}`);
  }

  // Phase: quiz — redirect to quiz-page
  if (phase === "quiz") {
    if (!quiz_stage) {
      throw redirect(`/sessions/${sessionId}/list`);
    }
    throw redirect(`/quiz/${quiz_stage.stage_id}?session=${sessionId}`);
  }

  // Phase: hook — render hook screen
  const product = ps.nv2_learning_products as any;

  return {
    sessionId,
    product_name:     product?.name ?? "",
    session_number:   ps.session_number,
    chapter_title,
    hook_text,
    illustration_url,
    learning_count:   learning_stages.length,
    has_story:        !!story_stage,
    has_quiz:         !!quiz_stage,
  };
}

// ---------------------------------------------------------------------------
// Component — Hook Screen (Phase 0)
// ---------------------------------------------------------------------------

export default function StorySessionPage() {
  const {
    sessionId,
    product_name,
    session_number,
    chapter_title,
    hook_text,
    illustration_url,
    learning_count,
  } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08]">
        <button
          onClick={() => window.history.back()}
          className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center"
          aria-label="뒤로 가기"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7l4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/40 truncate">
            {product_name}{session_number != null ? ` · Chapter ${session_number}` : ""}
          </p>
          {chapter_title && (
            <p className="text-sm font-semibold text-white/80 truncate">{chapter_title}</p>
          )}
        </div>
      </div>

      {/* Illustration */}
      {illustration_url && (
        <div className="w-full aspect-[2/1] overflow-hidden">
          <img
            src={illustration_url}
            alt={chapter_title ?? "chapter illustration"}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Hook content */}
      <div className="flex-1 flex flex-col px-6 py-8">

        {/* Chapter badge */}
        <div className="mb-6">
          <span className="inline-block rounded-full bg-white/[0.08] px-3 py-1 text-xs font-bold tracking-wider text-white/50 uppercase">
            Chapter {session_number}
          </span>
          {chapter_title && (
            <h1 className="mt-2 font-display text-2xl font-black text-white leading-snug">
              {chapter_title}
            </h1>
          )}
        </div>

        {/* Hook text */}
        {hook_text ? (
          <div className="mb-8 rounded-2xl bg-white/[0.05] border border-white/[0.08] px-5 py-5">
            <p className="text-sm font-medium leading-[1.85] text-white/75 whitespace-pre-line">
              {hook_text}
            </p>
          </div>
        ) : (
          <div className="mb-8" />
        )}

        {/* Learning flow info */}
        <div className="mb-8 space-y-2.5">
          <FlowStep num={1} label={`단어 카드 학습 (${learning_count}개)`} desc="이 챕터의 단어를 먼저 학습합니다." />
          <FlowStep num={2} label="챕터 읽기" desc="이야기 속에서 단어를 다시 만납니다." />
          <FlowStep num={3} label="퀴즈" desc="배운 단어를 확인합니다." />
        </div>

        {/* CTA */}
        <div className="mt-auto">
          <Link
            to={`/sessions/${sessionId}/story?phase=learn&idx=0`}
            className="block w-full rounded-2xl bg-white py-4 text-center text-sm font-extrabold text-[#0d1117] transition-all hover:bg-white/90 active:scale-[0.98]"
          >
            학습 시작 →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlowStep
// ---------------------------------------------------------------------------

function FlowStep({ num, label, desc }: { num: number; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs font-black text-white/60">
        {num}
      </div>
      <div>
        <p className="text-sm font-bold text-white/80">{label}</p>
        <p className="text-xs text-white/40">{desc}</p>
      </div>
    </div>
  );
}
