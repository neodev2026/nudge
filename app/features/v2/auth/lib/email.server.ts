/**
 * Email service module for Nudge v2.
 *
 * Handles transactional email delivery via Resend.
 * Mirrors the public API surface of discord.server.ts so dispatch.tsx
 * can call either channel with identical arguments.
 *
 * Supported message types:
 *   - sendWelcomeEmail   — sent once after Google/email sign-up (new users only)
 *   - sendSessionEmail   — sent by Cron dispatch for new / review sessions
 *
 * Cheer emails are intentionally NOT implemented — cheer DMs are Discord-only.
 *
 * Environment variables required:
 *   RESEND_API_KEY       — Resend API key
 *   APP_URL              — public origin, e.g. https://nudge.neowithai.com
 *
 * Sender address: Nudge <nudge@mail.neowithai.com>
 * Verified domain: mail.neowithai.com
 */

import resendClient from "~/core/lib/resend-client.server";

const FROM = "Nudge <nudge@mail.neowithai.com>";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Wraps content in a minimal, mobile-friendly HTML email shell.
 * Keeps styles inline for maximum email client compatibility.
 */
function buildHtmlEmail({
  preheader,
  body_html,
}: {
  preheader: string;
  body_html: string;
}): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nudge</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <!-- preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f7fa;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

          <!-- Header bar -->
          <tr>
            <td style="background-color:#1a2744;padding:20px 32px;">
              <span style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">Nudge</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body_html}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e8ecf5;background-color:#fafbfd;">
              <p style="margin:0;font-size:11px;color:#b0b8cc;line-height:1.6;">
                학습 알림을 더 이상 받고 싶지 않으시다면 계정 설정에서 이메일 알림을 끄실 수 있습니다.<br />
                © 2026 Nudge by NeoWithAI
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Renders a CTA button block used in session / welcome emails.
 */
function ctaButton(label: string, url: string, color = "#4caf72"): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
    <tr>
      <td style="background-color:${color};border-radius:12px;">
        <a href="${url}"
           style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:-0.3px;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a welcome email to a newly registered Google/email user.
 *
 * Called once from google-callback.tsx immediately after profile upsert.
 *
 * @param email        - Recipient email address
 * @param display_name - User's display name for personalisation
 * @param products_url - URL to the products page (default landing after sign-up)
 */
export async function sendWelcomeEmail(
  email: string,
  display_name: string | null,
  products_url: string
): Promise<void> {
  const name = display_name ?? "학습자";

  const body_html = `
    <p style="margin:0 0 8px;font-size:22px;font-weight:900;color:#1a2744;letter-spacing:-0.5px;">
      환영합니다, ${name} 님! 👋
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7a99;line-height:1.7;">
      Nudge에 가입해주셔서 감사합니다.<br />
      매일 아침 학습 링크를 이메일로 보내드릴게요.<br />
      지금 바로 학습할 상품을 선택해보세요!
    </p>
    <p style="margin:0;font-size:13px;color:#b0b8cc;">
      📌 알림 수신 시간은 계정 설정에서 변경할 수 있어요.
    </p>
    ${ctaButton("학습 시작하기 →", products_url)}
  `;

  await resendClient.emails.send({
    from: FROM,
    to: email,
    subject: `${name} 님, Nudge에 오신 걸 환영합니다! 🎉`,
    html: buildHtmlEmail({
      preheader: "Nudge에 가입해주셔서 감사합니다. 지금 바로 학습을 시작해보세요!",
      body_html,
    }),
  });
}

/**
 * Sends a session link email to a user (new session or review).
 *
 * Called by dispatch.tsx when the user has no discord_id but has an email address.
 *
 * @param email         - Recipient email address
 * @param session_url   - Full URL to the session page
 * @param product_name  - Product name shown in the email (e.g. "Deutsch B1")
 * @param session_title - Session title (e.g. "Session 14")
 * @param review_round  - Review round number (null for new sessions)
 */
/**
 * Sends a marathon nudge email with the current card preview and a resume link.
 *
 * Called by dispatch.tsx when the user has no discord_id.
 */
export async function sendMarathonNudgeEmail({
  to,
  product_name,
  last_stage_index,
  front,
  back,
  resume_url,
}: {
  to: string;
  product_name: string;
  last_stage_index: number;
  front: string;
  back: string;
  resume_url: string;
}): Promise<void> {
  const subject = `🏃 ${product_name} 마라톤 — 계속 달려볼까요?`;
  const preheader = `${last_stage_index}번 단어까지 완료! 지금 이어서 학습해보세요.`;

  const card_block = front
    ? `<div style="background-color:#f0f4ff;border-radius:12px;padding:16px 20px;margin:16px 0;">
        <p style="margin:0 0 4px;font-size:16px;font-weight:800;color:#1a2744;">${front}</p>
        <p style="margin:0;font-size:14px;color:#6b7a99;">${back}</p>
      </div>`
    : "";

  const body_html = `
    <p style="margin:0 0 8px;font-size:20px;font-weight:900;color:#1a2744;letter-spacing:-0.5px;">
      🏃 ${product_name} 마라톤 학습
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#6b7a99;line-height:1.7;">
      ${last_stage_index}번 단어까지 완료했어요!
    </p>
    ${card_block}
    ${ctaButton("이어하기 →", resume_url, "#4caf72")}
  `;

  await resendClient.emails.send({
    from: FROM,
    to,
    subject,
    html: buildHtmlEmail({ preheader, body_html }),
  });
}

export async function sendSessionEmail(
  email: string,
  session_url: string,
  product_name: string,
  session_title: string,
  review_round: number | null = null
): Promise<void> {
  const is_review = review_round !== null;

  const context_line = product_name
    ? `${product_name}${session_title ? ` · ${session_title}` : ""}`
    : session_title || "오늘의 학습";

  const subject = is_review
    ? `🔁 [${context_line}] 복습 ${review_round}회차가 준비됐어요`
    : `📚 [${context_line}] 새 학습 세션이 준비됐어요`;

  const preheader = is_review
    ? `${context_line} 복습 ${review_round}회차 — 잊기 전에 복습해봐요!`
    : `${context_line} — 새 단어들이 기다리고 있어요!`;

  const heading = is_review
    ? `🔁 복습 ${review_round}회차`
    : "📚 새 학습 세션";

  const description = is_review
    ? `<strong>${context_line}</strong><br />잊기 전에 복습해봐요! 아래 버튼을 눌러 시작하세요.`
    : `<strong>${context_line}</strong><br />새 단어들이 기다리고 있어요. 아래 버튼을 눌러 시작하세요!`;

  const button_label = is_review ? "복습 시작 →" : "학습 시작 →";
  const button_color = is_review ? "#5865f2" : "#4caf72";

  const body_html = `
    <p style="margin:0 0 8px;font-size:20px;font-weight:900;color:#1a2744;letter-spacing:-0.5px;">
      ${heading}
    </p>
    <p style="margin:0;font-size:14px;color:#6b7a99;line-height:1.7;">
      ${description}
    </p>
    ${ctaButton(button_label, session_url, button_color)}
    <p style="margin:20px 0 0;font-size:12px;color:#b0b8cc;line-height:1.6;">
      링크는 언제든지 다시 클릭할 수 있어요.<br />
      로그인 없이 바로 학습할 수 있습니다.
    </p>
  `;

  await resendClient.emails.send({
    from: FROM,
    to: email,
    subject,
    html: buildHtmlEmail({ preheader, body_html }),
  });
}
