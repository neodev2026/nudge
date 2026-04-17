/**
 * v2 Navigation Bar
 *
 * Shown on public-facing pages: landing, products, login, join.
 * Adapts based on auth state:
 *   - Unauthenticated: "로그인" + "회원가입" buttons
 *   - Authenticated:   avatar dropdown with display_name + logout
 */
import { Link } from "react-router";
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

interface V2NavProps {
  user?: {
    display_name: string | null;
    email: string | null;
    avatar_url?: string | null;
  } | null;
}

export function V2Nav({ user }: V2NavProps) {
  return (
    <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#1a2744]/[0.07] bg-[#fdf8f0]/90 px-6 backdrop-blur-xl md:px-10">
      {/* Logo */}
      <Link to="/" className="flex items-center">
        <span className="font-display text-2xl font-black tracking-tight text-[#1a2744]">
          Nudge<span className="text-[#4caf72]">.</span>
        </span>
      </Link>

      {/* Center nav links */}
      <ul className="hidden gap-8 md:flex">
        <li>
          <Link
            to="/products"
            className="text-sm font-semibold text-[#6b7a99] transition-colors hover:text-[#1a2744]"
          >
            학습 상품
          </Link>
        </li>
      </ul>

      {/* Right: auth controls */}
      <div className="flex items-center gap-3">
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
                <Link to="/products" className="cursor-pointer">
                  학습 상품
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
    </nav>
  );
}
