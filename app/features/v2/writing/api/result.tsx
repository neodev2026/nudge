/**
 * POST /api/v2/writing/:stageId/result
 *
 * Accepts the user's writing submission, returns AI feedback via OpenAI,
 * and marks the writing stage as completed.
 *
 * Request body (JSON):
 *   {
 *     sns_type: string,
 *     sns_id: string,
 *     text: string,          // user's writing
 *     target_locale: string, // e.g. "de"
 *     words: string[],       // session vocabulary used as context
 *   }
 *
 * Response:
 *   { ok: true, feedback: string, corrected?: string }
 */
import { data as routeData } from "react-router";
import type { Route } from "./+types/result";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "database.types";
import {
  initNv2StageProgress,
  completeNv2Stage,
} from "~/features/v2/stage/lib/queries.server";
import type { SnsType } from "~/features/v2/shared/types";

// ---------------------------------------------------------------------------
// OpenAI feedback helper
// ---------------------------------------------------------------------------

async function getWritingFeedback(
  user_text: string,
  target_locale: string,
  words: string[]
): Promise<{ feedback: string; corrected?: string }> {
  const api_key = process.env.OPENAI_API_SECRET_NUDGE_LENI_CHAT;
  if (!api_key) {
    return { feedback: "피드백 서비스를 사용할 수 없습니다." };
  }

  const locale_names: Record<string, string> = {
    de: "German", en: "English", ja: "Japanese",
    fr: "French", es: "Spanish", ko: "Korean",
  };
  const lang_name = locale_names[target_locale] ?? target_locale;
  const word_list = words.slice(0, 10).join(", ");

  const system_prompt = `You are a friendly ${lang_name} language teacher giving feedback on a student's writing exercise.
The student was asked to write using these vocabulary words: ${word_list}.
Provide feedback in Korean (학습자 언어).
Be encouraging and constructive.
If the writing has grammar errors, provide a corrected version.
Respond ONLY with JSON: {"feedback": "...", "corrected": "..." }
corrected is optional — only include if there are corrections to make.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${api_key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system_prompt },
        { role: "user", content: user_text },
      ],
      max_tokens: 400,
      temperature: 0.7,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    console.error("[writing-result] OpenAI error:", res.status);
    return { feedback: "피드백을 불러오는 데 실패했어요. 잘 쓰셨어요! 👍" };
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";

  try {
    const parsed = JSON.parse(raw);
    return {
      feedback: typeof parsed.feedback === "string" ? parsed.feedback : "잘 쓰셨어요!",
      corrected: typeof parsed.corrected === "string" ? parsed.corrected : undefined,
    };
  } catch {
    return { feedback: "잘 쓰셨어요! 계속 연습해봐요 😊" };
  }
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return routeData({ error: "Method not allowed" }, { status: 405 });
  }

  let body: {
    sns_type?: string;
    sns_id?: string;
    text?: string;
    target_locale?: string;
    words?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return routeData({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sns_type, sns_id, text, target_locale = "de", words = [] } = body;

  if (!sns_type || !sns_id) {
    return routeData(
      { error: "sns_type and sns_id are required" },
      { status: 400 }
    );
  }

  if (!text?.trim()) {
    return routeData({ error: "text is required" }, { status: 400 });
  }

  // ── Get AI feedback ───────────────────────────────────────────────────────
  const { feedback, corrected } = await getWritingFeedback(
    text.trim(),
    target_locale,
    words
  );

  // ── Mark stage complete ───────────────────────────────────────────────────
  const service_client = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await initNv2StageProgress(
    service_client,
    sns_type as SnsType,
    sns_id,
    params.stageId
  ).catch((err) => console.error("[writing-result] init failed:", err));

  await completeNv2Stage(
    service_client,
    sns_type as SnsType,
    sns_id,
    params.stageId
  ).catch((err) => console.error("[writing-result] complete failed:", err));

  return routeData({ ok: true, feedback, corrected });
}
