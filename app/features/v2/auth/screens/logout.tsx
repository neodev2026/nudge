/**
 * GET /auth/logout
 *
 * Signs the user out via Supabase and redirects to landing page.
 */
import type { Route } from "./+types/logout";
import { redirect } from "react-router";
import makeServerClient from "~/core/lib/supa-client.server";

export async function loader({ request }: Route.LoaderArgs) {
  const [client, headers] = makeServerClient(request);
  await client.auth.signOut();
  return redirect("/", { headers });
}

export default function Logout() {
  return null;
}
