import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { ApiError, apiFetch } from "./api";
import { SESSION_COOKIE, readClaims, secondsLeft } from "./session-token";
import type { AuthUser } from "@/types/admin";

/**
 * The signed-in user's session, readable by server code only.
 *
 * The JWT lives in an httpOnly cookie (set by `POST /api/session`), so no
 * client JavaScript can read it — `document.cookie` does not see it and it
 * never ships in a bundle. Server components and route handlers read it here
 * and forward it to the API as a bearer token; the API itself never sees the
 * cookie.
 *
 * There is no refresh token and no `/auth/logout`: the backend issues a 24h
 * JWT and that is the whole lifecycle. The cookie's max-age is set to the
 * token's own expiry, so the two die together, and a 401 always means
 * "sign in again".
 */

export interface Session {
  accessToken: string;
  userId: string;
  expiresAt: Date;
}

/**
 * The current session, or null when there is none or it has expired.
 *
 * Cheap — reads a cookie and decodes a JWT, no network. Deduplicated per
 * request with `cache`, so any number of components can call it. It says
 * nothing about the user's role; see `getCurrentUser()`.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = readClaims(token);
  if (!claims || secondsLeft(claims) <= 0) return null;
  return {
    accessToken: token,
    userId: claims.sub,
    expiresAt: new Date(claims.exp * 1000),
  };
});

/**
 * The signed-in user from `GET /auth/me`, or null when signed out or the
 * token has been rejected.
 *
 * This is the only trustworthy source for `role`: the JWT's copy is stamped
 * at login, while the API re-reads the user row on every request. Fetched
 * fresh per request (`no-store`) and deduplicated within it, so a role change
 * shows up on the next page load without signing in again.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getSession();
  if (!session) return null;
  try {
    return await apiFetch<AuthUser>("/auth/me", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
});

/**
 * Cookie attributes for a token with `maxAge` seconds to live.
 *
 * `Secure` is off in development only so `next dev` works over plain HTTP on
 * every browser (Safari refuses Secure cookies on http://localhost).
 * `SameSite=Lax` keeps the cookie on top-level navigations from a payment
 * gateway back to `/checkout/callback`, which `Strict` would drop.
 */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
