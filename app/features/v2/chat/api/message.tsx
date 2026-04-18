/**
 * POST /api/v2/chat/:sessionId/message
 *
 * Receives a user message, calls OpenAI (Leni), saves both turns to DB,
 * and returns Leni's response including optional card/quiz bubble data.
 *
 * Response:
 *   { ok: true, text, type?, card_id?, stage_id?, card_data?, session_complete }
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/message";

import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { getSessionIdentity } from "~/features/v2/session/lib/queries.server";
import { getNv2ProductSessionWithStages } from "~/features/v2/session/lib/queries.server";
import { getNv2StageWithCards } from "~/features/v2/stage/lib/queries.server";
import type { V2CardData } from "~/features/v2/shared/types";
import type { LeniCardContext, LeniQuizStage, LeniChatMessage } from "../lib/leni.server";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  const [client, headers] = makeServerClient(request);

  // ── Auth check ────────────────────────────────────────────────────────────
  const { data: { user: auth_user } } = await client.auth.getUser();
  if (!auth_user) {
    return routeData({ error: "Unauthorized" }, { status: 401, headers });
  }

  // ── Parse request body ────────────────────────────────────────────────────
  let user_message = "";
  try {
    const body = await request.json();
    user_message = typeof body.message === "string" ? body.message.trim() : "";
  } catch {
    return routeData({ error: "Invalid request body" }, { status: 400, headers });
  }

  if (!user_message) {
    return routeData({ error: "Message is required" }, { status: 400, headers });
  }

  // ── Load session ──────────────────────────────────────────────────────────
  const identity = await getSessionIdentity(client, params.sessionId).catch(() => null);
  if (!identity) {
    return routeData({ error: "Session not found" }, { status: 404, headers });
  }

  // ── Anonymous session check ──────────────────────────────────────────────
  // Anonymous trial users can see Leni's intro cards but cannot send messages.
  if (identity.auth_user_id.startsWith("anon:")) {
    return routeData({
      ok: true,
      text: "Leni와의 채팅은 유료입니다. 무료 체험은 학습 목록에서 진행해주세요.",
      type: "text",
      session_complete: false,
    }, { headers });
  }

  // ── Load product session with stages ─────────────────────────────────────
  const product_session = await getNv2ProductSessionWithStages(
    client,
    identity.product_session_id
  ).catch(() => null);

  if (!product_session) {
    return routeData({ error: "Product session not found" }, { status: 404, headers });
  }

  const session_title =
    product_session.title ?? `Session ${product_session.session_number}`;

  const stages = product_session.nv2_product_session_stages ?? [];

  // ── Collect all quiz stages (preserve display_order) ────────────────────
  const QUIZ_STAGE_TYPES = [
    "quiz_current_session",
    "quiz_5",
    "quiz_10",
    "quiz_current_and_prev_session",
    "sentence_practice",
    "dictation",
    "writing",
  ];
  const quiz_stages: LeniQuizStage[] = stages
    .filter((s) => QUIZ_STAGE_TYPES.includes((s.nv2_stages as any)?.stage_type))
    .map((s, i) => ({
      stage_id: s.stage_id,
      stage_type: (s.nv2_stages as any)?.stage_type ?? "quiz_5",
      title: (s.nv2_stages as any)?.title ?? `Quiz ${i + 1}`,
      display_order: (s as any).display_order ?? i + 1,
    }));

  // ── Build card context (learning stages only) ─────────────────────────────
  const learning_stages = stages.filter(
    (s) => (s.nv2_stages as any)?.stage_type === "learning"
  );

  const card_contexts: LeniCardContext[] = [];

  for (const s of learning_stages) {
    const stage = await getNv2StageWithCards(client, s.stage_id).catch(() => null);
    if (!stage) continue;

    const cards = stage.nv2_cards ?? [];
    const title_card = cards.find((c) => c.card_type === "title");
    const desc_card = cards.find((c) => c.card_type === "description");
    const example_card = cards.find((c) => c.card_type === "example");

    if (!title_card) continue;

    const title_data = title_card.card_data as unknown as V2CardData;
    const desc_data = desc_card?.card_data as unknown as V2CardData | undefined;
    const example_data = example_card?.card_data as unknown as V2CardData | undefined;

    card_contexts.push({
      stage_id: s.stage_id,
      card_id: title_card.id,
      stage_title: stage.title,
      word: title_data?.presentation?.front ?? stage.title,
      meaning: title_data?.presentation?.back ?? "",
      description: desc_data?.presentation?.front ?? "",
      example: example_data?.presentation?.front,
      example_translation: example_data?.presentation?.back,
      target_locale: title_data?.meta?.target_locale ?? "unknown",
      learner_locale: title_data?.meta?.learner_locale ?? "ko",
    });
  }

  // ── Load conversation history ─────────────────────────────────────────────
  const { data: history_rows } = await adminClient
    .from("nv2_chat_turns")
    .select("role, content")
    .eq("session_id", params.sessionId)
    .eq("auth_user_id", auth_user.id)
    .order("created_at", { ascending: true })
    .limit(40);

  const history: LeniChatMessage[] = (history_rows ?? []).map((row) => {
    let text = "";
    try {
      const parsed = JSON.parse(row.content);
      text = typeof parsed.text === "string" ? parsed.text : row.content;
    } catch {
      text = row.content;
    }
    return { role: row.role as "leni" | "user", text };
  });

  // ── Call OpenAI (Leni) ────────────────────────────────────────────────────
  const { getLeniResponse } = await import("../lib/leni.server");

  const display_name =
    (auth_user.user_metadata?.full_name as string | undefined) ??
    (auth_user.user_metadata?.global_name as string | undefined) ??
    "학습자";

  let leni_response;
  try {
    // Fetch product category for system prompt
    const { data: product_row } = await adminClient
      .from("nv2_learning_products")
      .select("category")
      .eq("id", product_session.product_id)
      .maybeSingle();
    const product_category = product_row?.category ?? "language";

    leni_response = await getLeniResponse(
      user_message,
      history,
      card_contexts,
      quiz_stages,
      display_name,
      session_title,
      product_category,
      (identity.session_kind ?? "new") as "new" | "review",
      identity.review_round ?? null
    );
  } catch (err) {
    console.error("[chat/message] getLeniResponse failed:", err);
    return routeData({ error: "AI response failed" }, { status: 500, headers });
  }

  // ── Turn balance check ───────────────────────────────────────────────────
  // Fetch user's turn balance — if both buckets are 0, return payment prompt
  const { data: balance_row } = await adminClient
    .from("nv2_turn_balance")
    .select("id, subscription_turns, charged_turns")
    .eq("auth_user_id", auth_user.id)
    .maybeSingle();

  const subscription_turns = balance_row?.subscription_turns ?? 0;
  const charged_turns = balance_row?.charged_turns ?? 0;
  const total_turns = subscription_turns + charged_turns;

  if (total_turns <= 0) {
    return routeData(
      {
        ok: false,
        out_of_turns: true,
        text: "앗, 오늘 대화 횟수를 다 썼어요 😢 더 이야기하려면 턴을 충전해주세요!",
      },
      { headers }
    );
  }

  // ── Handle complete_stages flag — mark all learning stages done ─────────
  // When Leni sets complete_stages:true (step 3), mark all learning stages complete.
  if (leni_response.complete_stages) {
    const { auth_user_id } = identity;
    await Promise.all(
      learning_stages.map(async (s) => {
        // init progress row if not exists
        const { data: existing } = await adminClient
          .from("nv2_stage_progress")
          .select("progress_id, completed_at")
          .eq("auth_user_id", auth_user_id)
          .eq("stage_id", s.stage_id)
          .maybeSingle();

        if (!existing) {
          try {
            await adminClient.from("nv2_stage_progress").insert({
              auth_user_id,
              stage_id: s.stage_id,
            });
          } catch {
            // Row may already exist — ignore
          }
        }

        // complete if not already done
        if (!existing?.completed_at) {
          const now = new Date();
          const next_review = new Date(now);
          next_review.setUTCDate(next_review.getUTCDate() + 1);
          try {
            await adminClient
              .from("nv2_stage_progress")
              .update({
                completed_at: now.toISOString(),
                review_status: "r1_pending",
                review_round: 1,
                next_review_at: next_review.toISOString(),
              })
              .eq("auth_user_id", auth_user_id)
              .eq("stage_id", s.stage_id)
              .is("completed_at", null);
          } catch {
            // Already completed — ignore
          }
        }
      })
    );
  }

  // ── Resolve card data for each card bubble ───────────────────────────────
  // bubbles is an array — fetch card data for every card bubble in parallel
  const resolved_bubbles = await Promise.all(
    leni_response.bubbles.map(async (bubble) => {
      if (bubble.type === "card" && bubble.card_id) {
        const target_ctx = card_contexts.find((c) => c.card_id === bubble.card_id);
        if (target_ctx) {
          const stage = await getNv2StageWithCards(client, target_ctx.stage_id).catch(() => null);
          if (stage?.nv2_cards?.length) {
            return { ...bubble, cards: stage.nv2_cards };
          }
        }
      }
      // For quiz bubbles: enrich with stage_type and title from quiz_stages list
      if (bubble.type === "quiz" && bubble.stage_id) {
        const matched = quiz_stages.find((q) => q.stage_id === bubble.stage_id);
        if (matched) {
          return {
            ...bubble,
            stage_type: matched.stage_type,
            title: bubble.title ?? matched.title,
          };
        }
      }
      return bubble;
    })
  );

  // ── Save turns to DB ──────────────────────────────────────────────────────
  await adminClient.from("nv2_chat_turns").insert({
    auth_user_id: auth_user.id,
    session_id: params.sessionId,
    role: "user",
    message_type: "text",
    content: JSON.stringify({ text: user_message }),
  });

  // Determine message_type for DB: mixed if bubbles, else text
  const has_card = resolved_bubbles.some((b) => b.type === "card");
  const has_quiz = resolved_bubbles.some((b) => b.type === "quiz");
  const db_message_type = has_card ? "card" : has_quiz ? "quiz" : "text";

  await adminClient.from("nv2_chat_turns").insert({
    auth_user_id: auth_user.id,
    session_id: params.sessionId,
    role: "leni",
    message_type: db_message_type,
    // Store full bubbles array including card data for history restoration
    content: JSON.stringify({
      text: leni_response.text,
      bubbles: resolved_bubbles,
      complete_stages: leni_response.complete_stages,
    }),
  });

  // ── Deduct 1 turn ─────────────────────────────────────────────────────────
  if (balance_row) {
    if (subscription_turns > 0) {
      await adminClient
        .from("nv2_turn_balance")
        .update({ subscription_turns: subscription_turns - 1 })
        .eq("id", balance_row.id);
    } else if (charged_turns > 0) {
      await adminClient
        .from("nv2_turn_balance")
        .update({ charged_turns: charged_turns - 1 })
        .eq("id", balance_row.id);
    }
  }

  const remaining_turns = Math.max(0, total_turns - 1);

  return routeData(
    {
      ok: true,
      text: leni_response.text,
      bubbles: resolved_bubbles,
      complete_stages: leni_response.complete_stages,
      session_complete: leni_response.session_complete,
      remaining_turns,
    },
    { headers }
  );
}
