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
 * Sends a session link DM to a user.
 *
 * Used by start-learning.tsx and cron/dispatch to deliver a session link.
 * A session contains multiple stages — the link points to the session page.
 *
 * @param sns_id      - Discord user ID
 * @param session_url - Full URL to the session page (/sessions/:sessionId)
 * @param title       - Session title shown as the embed heading
 * @param stage_count - Number of stages in the session (shown in description)
 */
export async function sendSessionDm(
  sns_id: string,
  session_url: string,
  title: string,
  stage_count: number
): Promise<void> {
  const channel_id = await openDmChannel(sns_id);

  await postEmbedWithButton(channel_id, {
    content: "📚 새 학습 세션이 준비됐어요!",
    embed: {
      title,
      description: `총 ${stage_count}개 단계로 구성되어 있어요. 아래 버튼을 눌러 시작하세요!`,
      color: 0x5865f2, // Discord blurple
    },
    button_label: "학습 시작 →",
    button_url: session_url,
  });
}

/**
 * Sends a session completion congratulation DM.
 *
 * Sent after a user completes all stages in a session.
 * Includes a link to the next session if one exists.
 *
 * @param sns_id           - Discord user ID
 * @param next_session_url - Full URL to the next session (null if last session)
 */
export async function sendSessionCompleteDm(
  sns_id: string,
  next_session_url: string | null
): Promise<void> {
  const channel_id = await openDmChannel(sns_id);

  if (next_session_url) {
    await postEmbedWithButton(channel_id, {
      content: "🎉 세션 완료! 정말 잘하셨어요!",
      embed: {
        title: "다음 세션도 도전해볼까요?",
        description:
          "내일 아침에 자동으로 발송되지만,\n지금 바로 시작하고 싶다면 아래 버튼을 눌러보세요!",
        color: 0x4caf72, // Nudge green
      },
      button_label: "다음 세션 시작 →",
      button_url: next_session_url,
    });
  } else {
    // Last session — no next session link
    const channel_id_final = await openDmChannel(sns_id);
    await postMessage(
      channel_id_final,
      "🏆 모든 학습을 완료했습니다! 정말 대단해요!\n복습 일정이 자동으로 진행됩니다. 수고하셨습니다!"
    );
  }
}

/**
 * Adds a Discord user to a guild (server) using their OAuth access token.
 * This is required so the bot can send DMs to users who share no mutual guild.
 *
 * Requires:
 *   - Bot permission: CREATE_INSTANT_INVITE (or Manage Server)
 *   - OAuth scope: guilds.join
 *   - Env: NUDGE_DISCORD_GUILD_ID
 *
 * HTTP 201 = user newly added, 204 = already a member — both are success.
 */
export async function addUserToGuild(
  access_token: string,
  user_id: string,
  guild_id: string
): Promise<void> {
  const res = await fetch(
    `${DISCORD_API_URL}/guilds/${guild_id}/members/${user_id}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token }),
    }
  );

  // 201 = newly added, 204 = already a member — both are fine
  if (!res.ok && res.status !== 204) {
    const body = await res.text();
    throw new Error(`addUserToGuild failed [${res.status}]: ${body}`);
  }
}
