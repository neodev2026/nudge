/**
 * Minimal header for Hyper-Sync pages.
 *
 * v2-nav layout is intentionally NOT applied to hyper-sync routes — the
 * "학습 방법 / 학습 상품 / 마라톤 랭킹" menu items would feel out of place.
 * This header shows only the Nudge logo (linking back to home) plus
 * login/signup CTAs when the visitor is anonymous.
 *
 * isAuthenticated is REQUIRED — every page must pass it explicitly so we
 * don't accidentally render auth CTAs to a signed-in user. The review page
 * always passes `true` (its loader redirects anonymous visitors to /login).
 */
import { Link, useLocation } from "react-router";

export function HyperSyncHeader({
  subtitle,
  isAuthenticated,
}: {
  subtitle?: string;
  isAuthenticated: boolean;
}) {
  const location = useLocation();
  const nextParam = encodeURIComponent(location.pathname + location.search);

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-7 py-5">
      <Link
        to="/"
        className="font-mono text-sm tracking-[0.08em] text-[#c8f564] hover:opacity-80"
        aria-label="Nudge home"
      >
        NUDGE
        {subtitle ? (
          <span className="ml-1 text-white/40"> / {subtitle}</span>
        ) : null}
      </Link>

      {!isAuthenticated && (
        <nav className="flex items-center gap-2.5">
          <Link
            to={`/login?next=${nextParam}`}
            className="font-mono text-xs text-white/60 transition hover:text-white"
          >
            로그인
          </Link>
          <Link
            to={`/join?next=${nextParam}`}
            className="rounded border border-[#c8f564]/30 bg-[#c8f564]/10 px-3 py-1.5 font-mono text-xs font-bold text-[#c8f564] transition hover:bg-[#c8f564]/20"
          >
            회원가입
          </Link>
        </nav>
      )}
    </header>
  );
}
