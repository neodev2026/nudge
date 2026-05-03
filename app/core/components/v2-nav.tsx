/**
 * v2 Navigation Bar
 *
 * Shown on public-facing pages: landing, products, login, join.
 * Adapts based on auth state:
 *   - Unauthenticated: "로그인" + "회원가입" buttons
 *   - Authenticated:   avatar dropdown with display_name + logout
 *
 * Mobile: hamburger icon opens a Sheet drawer with nav links + auth section.
 */
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "~/core/components/ui/avatar";
import { Button } from "~/core/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/core/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "~/core/components/ui/sheet";

interface V2NavProps {
  user?: {
    display_name: string | null;
    email: string | null;
    avatar_url?: string | null;
  } | null;
}

const LANDING_NAV_LINKS = [
  { href: "#how",      label: "어떻게 하나요" },
  { href: "#products", label: "학습 상품" },
  { href: "#leni",     label: "Leni 소개" },
  { href: "#roadmap",  label: "로드맵" },
] as const;

export function V2Nav({ user }: V2NavProps) {
  const { pathname } = useLocation();
  const isLanding = pathname === "/";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#1a2744]/[0.07] bg-[#fdf8f0]/90 px-6 backdrop-blur-xl md:px-10">
      {/* Logo + BETA badge */}
      <Link to="/" className="flex items-center">
        <span className="font-display text-2xl font-black tracking-tight text-[#1a2744]">
          Nudge<span className="text-[#4caf72]">.</span>
        </span>
        <span className="ml-1.5 rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-amber-700">
          BETA
        </span>
      </Link>

      {/* Center nav links (desktop only) — landing: section anchors, others: page links */}
      <ul className="hidden gap-8 md:flex">
        {isLanding ? (
          LANDING_NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <a
                href={href}
                className="text-sm font-semibold text-[#6b7a99] transition-colors hover:text-[#1a2744]"
              >
                {label}
              </a>
            </li>
          ))
        ) : (
          <>
            <li>
              <Link
                to="/guide"
                className={`text-sm font-semibold transition-colors hover:text-[#1a2744] ${
                  pathname === "/guide" ? "text-[#1a2744]" : "text-[#6b7a99]"
                }`}
              >
                학습 방법
              </Link>
            </li>
            <li>
              <Link
                to="/products"
                className={`text-sm font-semibold transition-colors hover:text-[#1a2744] ${
                  pathname.startsWith("/products") ? "text-[#1a2744]" : "text-[#6b7a99]"
                }`}
              >
                학습 상품
              </Link>
            </li>
          </>
        )}
      </ul>

      {/* Right: auth controls (desktop) + hamburger (mobile) */}
      <div className="flex items-center gap-3">
        {/* Desktop auth */}
        <div className="hidden md:flex md:items-center md:gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full outline-none">
                  <Avatar className="size-8 cursor-pointer">
                    <AvatarImage src={user.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-[#1a2744] text-xs font-bold text-white">
                      {(user.display_name ?? user.email ?? "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="grid text-sm">
                  <span className="truncate font-semibold">
                    {user.display_name ?? "사용자"}
                  </span>
                  <span className="truncate text-xs text-[#6b7a99]">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/my-learning" className="cursor-pointer">
                    나의 학습 관리
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account" className="cursor-pointer">
                    계정 설정
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/auth/logout" className="cursor-pointer text-red-500">
                    로그아웃
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login" className="font-semibold text-[#6b7a99]">
                  로그인
                </Link>
              </Button>
              <Button
                size="sm"
                asChild
                className="rounded-full bg-[#1a2744] px-5 font-extrabold text-white hover:bg-[#243358]"
              >
                <Link to="/join">회원가입</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#1a2744] transition-colors hover:bg-[#1a2744]/[0.06] md:hidden"
              aria-label="메뉴 열기"
            >
              <HamburgerIcon />
            </button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-72 bg-[#fdf8f0] px-0 pt-0 text-[#1a2744]"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {/* Hidden title for Radix accessibility */}
            <SheetTitle className="sr-only">메뉴</SheetTitle>

            <div className="flex flex-col px-6 pb-4 pt-12">
              {/* Nav links */}
              <nav className="flex flex-col gap-1">
                <DrawerLink to="/guide" onClick={closeDrawer} active={pathname === "/guide"}>
                  학습 방법
                </DrawerLink>
                <DrawerLink to="/products" onClick={closeDrawer} active={pathname.startsWith("/products")}>
                  학습 상품
                </DrawerLink>
              </nav>

              <div className="my-5 border-t border-[#1a2744]/[0.07]" />

              {/* Auth section */}
              {user ? (
                <div className="flex flex-col gap-1">
                  {/* User info */}
                  <div className="mb-3 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
                    <Avatar className="size-9">
                      <AvatarImage src={user.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-[#1a2744] text-xs font-bold text-white">
                        {(user.display_name ?? user.email ?? "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#1a2744]">
                        {user.display_name ?? "사용자"}
                      </p>
                      <p className="truncate text-xs text-[#6b7a99]">{user.email}</p>
                    </div>
                  </div>
                  <DrawerLink to="/my-learning" onClick={closeDrawer}>나의 학습 관리</DrawerLink>
                  <DrawerLink to="/account" onClick={closeDrawer}>계정 설정</DrawerLink>
                  <div className="my-2 border-t border-[#1a2744]/[0.07]" />
                  <DrawerLink to="/auth/logout" onClick={closeDrawer} danger>로그아웃</DrawerLink>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Button asChild className="w-full rounded-full bg-[#1a2744] font-extrabold text-white hover:bg-[#243358]">
                    <Link to="/login" onClick={closeDrawer}>로그인</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full rounded-full font-extrabold">
                    <Link to="/join" onClick={closeDrawer}>회원가입</Link>
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Drawer link
// ---------------------------------------------------------------------------

function DrawerLink({
  to,
  onClick,
  active,
  danger,
  children,
}: {
  to: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-50"
          : active
          ? "bg-[#1a2744]/[0.06] text-[#1a2744]"
          : "text-[#6b7a99] hover:bg-[#1a2744]/[0.04] hover:text-[#1a2744]"
      }`}
    >
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
    </svg>
  );
}
