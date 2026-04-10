/**
 * /auth/discord/start
 *
 * Initiates the Discord OAuth flow via Supabase Auth.
 * Reads the browser timezone via Intl API, then redirects to
 * /auth/discord/start-oauth with ?tz=<IANA_timezone> appended.
 *
 * Why client-side redirect?
 *   The server cannot know the user's local timezone without a JS hint.
 *   Intl.DateTimeFormat().resolvedOptions().timeZone is the only reliable
 *   browser-side source. We perform a fast JS redirect before the OAuth hop
 *   so the timezone travels through to /auth/discord/callback.
 *
 * Flow:
 *   GET /auth/discord/start[?next=...]
 *     → useEffect reads Intl timezone
 *     → window.location.replace to /auth/discord/start-oauth?next=...&tz=<timezone>
 *     → start-oauth initiates Supabase OAuth with tz forwarded in redirectTo
 *     → Discord redirects back to /auth/discord/callback?next=...&tz=<timezone>
 */
import { useEffect } from "react";
import { useSearchParams } from "react-router";

export default function DiscordStart() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Capture browser timezone
    let tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      // Ignore — tz stays empty, server will use default
    }

    // Build redirect URL to start-oauth
    const params = new URLSearchParams();
    const next = searchParams.get("next");
    if (next) params.set("next", next);
    if (tz) params.set("tz", tz);
    const qs = params.toString();

    window.location.replace(
      "/auth/discord/start-oauth" + (qs ? "?" + qs : "")
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Minimal loading state — visible only for the brief moment before redirect
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#fdf8f0",
        fontFamily: "sans-serif",
        color: "#6b7a99",
        fontSize: "14px",
      }}
    >
      Discord로 연결 중...
    </div>
  );
}
