/**
 * Discord service module for Nudge v2.
 *
 * Handles direct communication with the Discord Bot API.
 * Used for sending DMs (welcome message, stage links, etc.).
 *
 * Environment variables required:
 *   DISCORD_BOT_TOKEN — bot token from Discord Developer Portal
 */

const DISCORD_API_URL = "https://discord.com/api/v10";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Opens (or retrieves an existing) DM channel with a Discord user.
 * Returns the channel id needed to post messages.
 */
async function openDmChannel(sns_id: string): Promise<string> {
  const res = await fetch(`${DISCORD_API_URL}/users/@me/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: sns_id }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord openDmChannel failed [${res.status}]: ${body}`);
  }

  const channel = await res.json();
  return channel.id as string;
}

/**
 * Posts a plain-text message to a Discord DM channel.
 */
async function postMessage(channel_id: string, content: string): Promise<void> {
  const res = await fetch(
    `${DISCORD_API_URL}/channels/${channel_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord postMessage failed [${res.status}]: ${body}`);
  }
}

/**
 * Posts an embed message with an action button to a Discord DM channel.
 */
async function postEmbedWithButton(
  channel_id: string,
  {
    content,
    embed,
    button_label,
    button_url,
  }: {
    content: string;
    embed: {
      title: string;
      description: string;
      color?: number;
    };
    button_label: string;
    button_url: string;
  }
): Promise<void> {
  const res = await fetch(
    `${DISCORD_API_URL}/channels/${channel_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        embeds: [embed],
        components: [
          {
            type: 1, // ACTION_ROW
            components: [
              {
                type: 2,   // BUTTON
                style: 5,  // LINK
                label: button_label,
                url: button_url,
              },
            ],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Discord postEmbedWithButton failed [${res.status}]: ${body}`
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a welcome DM to a newly onboarded user.
 *
 * Called once during the Discord OAuth callback after nv2_profiles is created.
 * The message links to the welcome stage page so the user can start immediately.
 *
 * @param sns_id      - Discord user ID (stored as nv2_profiles.sns_id)
 * @param display_name - User's Discord display name for personalisation
 * @param welcome_url  - Full URL to the welcome stage page
 */
export async function sendWelcomeDm(
  sns_id: string,
  display_name: string,
  welcome_url: string
): Promise<void> {
  const channel_id = await openDmChannel(sns_id);

  await postEmbedWithButton(channel_id, {
    content: `안녕하세요, **${display_name}** 님! 👋 Nudge에 오신 걸 환영합니다.`,
    embed: {
      title: "🎉 Nudge 학습을 시작해볼까요?",
      description:
        "아래 버튼을 눌러 첫 번째 카드를 확인하세요.\n" +
        "20초면 충분합니다. 지금 바로 시작해보세요!",
      color: 0x4caf72, // Nudge green
    },
    button_label: "첫 번째 카드 보기 →",
    button_url: welcome_url,
  });
}

/**
 * Sends a stage link DM to a user.
 *
 * Used by the cron dispatcher to deliver new / review stage links.
 *
 * @param sns_id    - Discord user ID
 * @param stage_url - Full URL to the stage page
 * @param title     - Stage title used as the embed heading
 */
export async function sendStageDm(
  sns_id: string,
  stage_url: string,
  title: string
): Promise<void> {
  const channel_id = await openDmChannel(sns_id);

  await postEmbedWithButton(channel_id, {
    content: "📖 새 학습 카드가 도착했어요!",
    embed: {
      title,
      description: "아래 버튼을 눌러 20초 학습을 시작하세요.",
      color: 0x5865f2, // Discord blurple
    },
    button_label: "학습 시작 →",
    button_url: stage_url,
  });
}
