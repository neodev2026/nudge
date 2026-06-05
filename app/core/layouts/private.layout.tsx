import type { LoaderFunctionArgs } from "react-router";

import { Outlet, redirect } from "react-router";

import makeServerClient from "../lib/supa-client.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const [client] = makeServerClient(request);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    throw redirect("/login");
  }

  // Return an empty object to avoid the "Cannot read properties of undefined" error
  return {};
}

export default function PrivateLayout() {
  return <Outlet />;
}
