/**
 * POST /admin/logout
 *
 * Signs out the current admin user and redirects to /admin/login.
 */
import { redirect } from "react-router";
import type { Route } from "./+types/logout";

import makeServerClient from "~/core/lib/supa-client.server";

export async function action({ request }: Route.ActionArgs) {
  const [client, headers] = makeServerClient(request);
  await client.auth.signOut();
  return redirect("/admin/login", { headers });
}
