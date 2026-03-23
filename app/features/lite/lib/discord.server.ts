/**
 * [Discord Service Module]
 * Handles all direct communication with Discord API without n8n.
 * Includes OAuth2 token exchange and message delivery.
 */

const DISCORD_API_URL = "https://discord.com/api/v10";

function getDiscordClientId() {
  return process.env.DISCORD_CLIENT_ID ?? process.env.DISCORD_OAUTH2_CLIENT_ID;
}

function getDiscordClientSecret() {
  return process.env.DISCORD_CLIENT_SECRET ?? process.env.DISCORD_OAUTH2_CLIENT_SECRET;
}

/**
 * Exchange OAuth2 code for an access token to get user information.
 */
export async function get_discord_data(code: string, redirectUri: string) {
  const clientId = getDiscordClientId();
  const clientSecret = getDiscordClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("Discord OAuth environment variables are missing");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(`${DISCORD_API_URL}/oauth2/token`, {
    method: "POST",
    body: params,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!response.ok) throw new Error("Failed to exchange Discord code");
  return response.json();
}

/**
 * Fetch the user's Discord ID using the access token.
 */
export async function get_discord_user_id(access_token: string) {
  const response = await fetch(`${DISCORD_API_URL}/users/@me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const data = await response.json();
  return data.id; // This becomes our sns_id
}

/**
 * Send a DM to a specific Discord user using the Bot Token.
 */
export async function send_discord_message(sns_id: string, message: string) {
  // 1. Create a DM channel with the user
  const channel_res = await fetch(`${DISCORD_API_URL}/users/@me/channels`, {
    method: "POST",
    body: JSON.stringify({ recipient_id: sns_id }),
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  const channel = await channel_res.json();

  // 2. Post the message to the created channel
  await fetch(`${DISCORD_API_URL}/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: message }),
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Send a structured learning card nudge via Discord DM.
 * Includes a direct link to the learning content.
 */
export async function send_card_nudge(
  sns_id: string, 
  { title, url }: { title: string; url: string }
) {
  const welcome_embed = {
    title: `📖 Today's Nudge: ${title}`,
    description: "Ready for your first session? Click the button below to start learning!",
    url: url,
    color: 0x10b981, // emerald-500
    footer: { text: "Nudge Lite - Learn by doing" }
  };

  const channel_res = await fetch(`${DISCORD_API_URL}/users/@me/channels`, {
    method: "POST",
    body: JSON.stringify({ recipient_id: sns_id }),
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  const channel = await channel_res.json();

  await fetch(`${DISCORD_API_URL}/channels/${channel.id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: `Here is your first card! 🚀`,
      embeds: [welcome_embed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "Start Learning Now",
              url: url
            }
          ]
        }
      ]
    }),
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
}