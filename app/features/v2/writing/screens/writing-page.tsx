/**
 * /writing/:stageId?session=:sessionId
 *
 * Writing stage — user composes sentences using session vocabulary,
 * receives AI (Leni) feedback with grammar correction.
 *
 * Prompt source priority:
 *   1. Writing stage's own card (admin-configured prompt text)
 *   2. Auto-generated from session learning stage words (fallback)
 *
 * Flow:
 *   1. Show writing prompt + vocabulary hint chips
 *   2. User writes in textarea
 *   3. Submit → POST to /api/v2/writing/:stageId/result → get AI feedback
 *   4. Show feedback + optional corrected version
 *   5. "완료" → redirect to session
 */
import type { Route } from "./+types/writing-page";

import { useLoaderData, useFetcher, Link } from "react-router";
import { useState, useRef, useEffect } from "react";
import { redirect } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import { getNv2ProductSessionWithStages } from "~/features/v2/session/lib/queries.server";
import { getNv2StageWithCards } from "~/features/v2/stage/lib/queries.server";
import type { V2CardData } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export const meta: Route.MetaFunction = () => [
  { title: "작문 연습 — Nudge" },
];

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export async function loader({ request, params }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);

  const session_id = new URL(request.url).searchParams.get("session");
  const from_chat = new URL(request.url).searchParams.get("from") === "chat";
  if (!session_id) {
    throw new Response("session parameter is required", { status: 400 });
  }

  // Load stage
  const { data: stage } = await client
    .from("nv2_stages")
    .select("id, stage_type, title, learning_product_id")
    .eq("id", params.stageId)
    .maybeSingle();

  if (!stage) throw new Response("Stage not found", { status: 404 });

  // Load session
  const { data: session } = await client
    .from("nv2_sessions")
    .select("session_id, product_session_id, auth_user_id")
    .eq("session_id", session_id)
    .maybeSingle();

  if (!session) throw new Response("Session not found", { status: 404 });

  // Access control
  const { data: { user: auth_user } } = await client.auth.getUser();
  const is_authenticated = !!auth_user;

  const { getSessionIdentity } = await import(
    "~/features/v2/session/lib/queries.server"
  );
  const identity = await getSessionIdentity(client, session_id).catch(() => null);

  if (identity?.link_access === "members_only" && !is_authenticated) {
    const next = encodeURIComponent(
      `/writing/${params.stageId}?session=${session_id}`
    );
    throw redirect(`/auth/discord/start?next=${next}`);
  }

  const auth_user_id = identity?.auth_user_id ?? (session as any).auth_user_id ?? null;

  // ── Load writing prompt from stage card (if admin configured one) ─────────
  const stage_with_cards = await getNv2StageWithCards(client, params.stageId).catch(() => null);
  const stage_card = stage_with_cards?.nv2_cards?.[0];
  const admin_prompt = stage_card
    ? ((stage_card.card_data as unknown as V2CardData)?.presentation?.front ?? null)
    : null;

  // ── Load session vocabulary (learning stages) ─────────────────────────────
  const product_session = await getNv2ProductSessionWithStages(
    client,
    session.product_session_id
  ).catch(() => null);

  const stages = product_session?.nv2_product_session_stages ?? [];
  const words: string[] = [];
  let target_locale = "de";

  for (const s of stages) {
    if ((s.nv2_stages as any)?.stage_type !== "learning") continue;
    const st = await getNv2StageWithCards(client, s.stage_id).catch(() => null);
    if (!st) continue;
    const title_card = st.nv2_cards?.find((c) => c.card_type === "title");
    if (title_card) {
      const data = title_card.card_data as unknown as V2CardData;
      words.push(data?.presentation?.front ?? "");
      target_locale = data?.meta?.target_locale ?? "de";
    }
  }

  // Final prompt
  const prompt = admin_prompt
    ?? `오늘 배운 단어(${words.slice(0, 3).join(", ")} 등)를 사용해서 짧은 문장이나 단락을 써보세요.`;

  return {
    stage_id: params.stageId,
    from_chat,
    stage_title: stage.title,
    session_id,
    auth_user_id,
    prompt,
    words: words.filter(Boolean),
    target_locale,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WritingPage() {
  const {
    stage_id,
    stage_title,
    session_id,
    auth_user_id,
    prompt,
    words,
    target_locale,
    from_chat,
  } = useLoaderData<typeof loader>();

  const [text, set_text] = useState("");
  const textarea_ref = useRef<HTMLTextAreaElement>(null);
  const result_fetcher = useFetcher<{
    ok?: boolean;
    feedback?: string;
    corrected?: string;
  }>();

  const is_submitting = result_fetcher.state !== "idle";
  const result = result_fetcher.data;
  const is_done = result?.ok === true;

  // Autofocus textarea on mount
  useEffect(() => {
    textarea_ref.current?.focus();
  }, []);

  // Redirect to session after user clicks complete (second click after feedback)
  function handleComplete() {
    if (from_chat) {
      window.close();
    } else {
      window.location.href = `/sessions/${session_id}/list`;
    }
  }

  function handleSubmit() {
    if (!text.trim() || is_submitting) return;
    result_fetcher.submit(
      { auth_user_id, text, target_locale, words },
      {
        method: "POST",
        action: `/api/v2/writing/${stage_id}/result`,
        encType: "application/json",
      }
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#fdf8f0]">
      {/* Header */}
      <div className="border-b border-[#e8ecf5] bg-white px-6 py-4">
        <div className="mx-auto max-w-md">
          <p className="text-xs font-bold uppercase tracking-wider text-[#4caf72]">
            작문 연습
          </p>
          <h1 className="font-display text-lg font-black text-[#1a2744]">
            {stage_title}
          </h1>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-md flex-1 px-6 py-8">
        <div className="space-y-5">

          {/* Prompt card */}
          <div className="rounded-2xl bg-white px-5 py-5 shadow-[0_2px_12px_rgba(26,39,68,0.08)]">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#6b7a99]">
              주제
            </p>
            <p className="text-sm font-bold leading-[1.8] text-[#1a2744]">
              {prompt}
            </p>
          </div>

          {/* Vocabulary chips */}
          {words.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold text-[#6b7a99]">오늘의 단어</p>
              <div className="flex flex-wrap gap-2">
                {words.map((w) => (
                  <span
                    key={w}
                    className="rounded-xl bg-[#1a2744]/5 px-3 py-1 text-xs font-bold text-[#1a2744]"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Textarea — disabled after submission */}
          <textarea
            ref={textarea_ref}
            value={text}
            onChange={(e) => set_text(e.target.value)}
            disabled={is_done || is_submitting}
            rows={6}
            placeholder="여기에 작문하세요…"
            className="w-full resize-none rounded-2xl border border-[#1a2744]/10 bg-white px-4 py-3 text-sm text-[#1a2744] placeholder:text-[#b0b8cc] focus:border-[#4caf72] focus:outline-none focus:ring-2 focus:ring-[#4caf72]/20 disabled:opacity-60"
          />

          {/* Submit button */}
          {!is_done && (
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || is_submitting}
              className="w-full rounded-2xl bg-[#4caf72] py-3.5 text-sm font-extrabold text-white transition hover:bg-[#5ecb87] disabled:opacity-50"
            >
              {is_submitting ? "피드백 받는 중…" : "제출하고 피드백 받기 →"}
            </button>
          )}

          {/* AI Feedback */}
          {result?.feedback && (
            <div className="space-y-3">
              {/* Leni feedback bubble */}
              <div className="flex items-start gap-2">
                <img
                  src="/images/leni/leni-chat-profile.png"
                  alt="Leni"
                  className="mt-1 h-8 w-8 shrink-0 rounded-full object-cover"
                />
                <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-relaxed text-[#1a2744] shadow-[0_2px_12px_rgba(26,39,68,0.08)]">
                  {result.feedback}
                </div>
              </div>

              {/* Corrected version */}
              {result.corrected && (
                <div className="rounded-2xl border border-[#4caf72]/20 bg-[#4caf72]/5 px-5 py-4">
                  <p className="mb-1 text-xs font-bold text-[#4caf72]">
                    교정된 문장
                  </p>
                  <p className="text-sm leading-[1.8] text-[#1a2744]">
                    {result.corrected}
                  </p>
                </div>
              )}

              {/* Complete button */}
              <button
                onClick={handleComplete}
                className="w-full rounded-2xl bg-[#1a2744] py-3.5 text-sm font-extrabold text-white transition hover:bg-[#2a3a5c]"
              >
                완료 ✓
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
