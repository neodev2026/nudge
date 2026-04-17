/**
 * v2-nav.layout.tsx
 *
 * Layout for public-facing pages that need the top navigation bar:
 *   /           (landing)
 *   /products   (product list)
 *   /products/:slug (product detail)
 *   /login
 *   /join
 *
 * Loads auth state server-side to decide what to show in the nav.
 */
import type { Route } from "./+types/v2-nav.layout";

import { Outlet } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";
import adminClient from "~/core/lib/supa-admin-client.server";
import { V2Nav } from "~/core/components/v2-nav";

export async function loader({ request }: Route.LoaderArgs) {
  const [client] = makeServerClient(request);
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return { user: null };
  }

  // Fetch display_name and avatar_url from nv2_profiles
  const { data: profile } = await adminClient
    .from("nv2_profiles")
    .select("display_name, avatar_url, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return {
    user: {
      display_name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      email: profile?.email ?? user.email ?? null,
    },
  };
}

export default function V2NavLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <div className="min-h-screen bg-[#fdf8f0]">
      <V2Nav user={user} />
      <Outlet />
    </div>
  );
}
