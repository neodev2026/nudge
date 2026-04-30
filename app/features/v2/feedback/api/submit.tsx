/**
 * POST /api/v2/feedback/submit
 *
 * Accepts feedback from any user (including anonymous / unauthenticated).
 * Persists to nv2_feedback via Drizzle (bypasses RLS).
 * Sends Discord webhook for "error" category only.
 */
import type { ActionFunctionArgs } from "react-router";

import makeServerClient from "~/core/lib/supa-client.server";
import db from "~/core/db/drizzle-client.server";
import { nv2_feedback } from "~/features/v2/feedback/schema";

export function shouldSendWebhook(category: string): boolean {
  return category === "error";
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "method not allowed" }, { status: 405 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return Response.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const { category, content, page_url } = body as Record<string, string>;

  if (!category || !content || !page_url) {
    return Response.json({ ok: false, error: "missing fields" }, { status: 400 });
  }
  if (content.length < 10) {
    return Response.json({ ok: false, error: "content too short" }, { status: 400 });
  }

  const valid_categories = ["error", "content", "suggestion", "other"];
  if (!valid_categories.includes(category)) {
    return Response.json({ ok: false, error: "invalid category" }, { status: 400 });
  }

  // auth_user_id is best-effort — null for unauthenticated / anonymous users
  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();
  const auth_user_id = user?.id ?? null;

  await db.insert(nv2_feedback).values({
    auth_user_id,
    page_url,
    category: category as "error" | "content" | "suggestion" | "other",
    content,
  });

  // Discord webhook — only for error reports; failure does not block response
  if (shouldSendWebhook(category) && process.env.DISCORD_FEEDBACK_WEBHOOK_URL) {
    try {
      await fetch(process.env.DISCORD_FEEDBACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: "🚨 오류 신고",
              color: 0xff0000,
              fields: [
                { name: "페이지", value: page_url, inline: false },
                { name: "내용", value: content, inline: false },
                { name: "사용자", value: auth_user_id ?? "비로그인", inline: true },
                { name: "시각", value: new Date().toISOString(), inline: true },
              ],
            },
          ],
        }),
      });
    } catch {
      console.error("Discord feedback webhook failed");
    }
  }

  return Response.json({ ok: true });
}
