import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, apiFetch, type ApiFetchOptions } from "./api";
import { getSession } from "./session";
import { NEXT_HEADER, expiredUrlFor, loginUrlFor } from "./session-token";

/**
 * `apiFetch` for server components and route handlers, authenticated with
 * the session cookie.
 *
 * A missing session redirects to sign-in; a 401 from the API redirects
 * through the expired route, which clears the dead cookie first. Either way
 * the user comes back to the page they were on — the proxy stamps it on the
 * request as `x-cp-next`. Every other error is thrown for the page's own
 * error handling, so a 403 still reads as "not yours", not "signed out".
 *
 * Never cached: authenticated responses are per-user, and Next's data cache
 * is shared.
 */
export async function serverFetch<T>(
  path: string,
  options: Omit<ApiFetchOptions, "auth" | "next"> = {},
): Promise<T> {
  const here = (await headers()).get(NEXT_HEADER) ?? "/";
  const session = await getSession();
  if (!session) redirect(loginUrlFor(here));

  try {
    return await apiFetch<T>(path, {
      ...options,
      cache: "no-store",
      headers: { ...options.headers, Authorization: `Bearer ${session.accessToken}` },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect(expiredUrlFor(here));
    throw err;
  }
}
