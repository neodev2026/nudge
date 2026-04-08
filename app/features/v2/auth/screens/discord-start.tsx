/**
 * /auth/discord/start
 *
 * Initiates the Discord OAuth flow via Supabase Auth.
 * Renders a minimal inline script that reads the browser timezone, then
 * redirects to /auth/discord/start-oauth with ?tz=<IANA_timezone> appended.
 *
 * Why client-side redirect?
 *   The server cannot know the user's local timezone without a JS hint.
 *   Intl.DateTimeFormat().resolvedOptions().timeZone is the only reliable
 *   browser-side source. We perform a fast JS redirect before the OAuth hop
 *   so the timezone travels through to /auth/discord/callback.
 *
 * Flow:
 *   GET /auth/discord/start[?next=...]
 *     → inline JS reads Intl timezone
 *     → redirect to /auth/discord/start-oauth?next=...&tz=<timezone>
 *     → start-oauth initiates Supabase OAuth with tz forwarded in redirectTo
 *     → Discord redirects back to /auth/discord/callback?next=...&tz=<timezone>
 */
import type { Route } from "./+types/discord-start";
import makeServerClient from "~/core/lib/supa-client.server";

export async function loader({ request }: Route.LoaderArgs) {
  const [, headers] = makeServerClient(request);

  const url_obj = new URL(request.url);
  const next_param = url_obj.searchParams.get("next") ?? "";
  const origin = url_obj.origin;

  // /auth/discord/start-oauth will perform the actual Supabase OAuth redirect
  const start_oauth_url = `${origin}/auth/discord/start-oauth`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>Redirecting…</title></head>
<body>
<script>
  (function () {
    var tz = "";
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    var next = ${JSON.stringify(next_param)};
    var params = new URLSearchParams();
    if (next) params.set("next", next);
    if (tz)   params.set("tz", tz);
    var qs = params.toString();
    window.location.replace(${JSON.stringify(start_oauth_url)} + (qs ? "?" + qs : ""));
  })();
</script>
<noscript>
  <meta http-equiv="refresh"
    content="0;url=${start_oauth_url}${next_param ? `?next=${encodeURIComponent(next_param)}` : ""}" />
</noscript>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      ...Object.fromEntries(headers.entries()),
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

// No default export — this route renders nothing meaningful
