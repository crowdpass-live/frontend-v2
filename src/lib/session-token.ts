/**
 * The session cookie and the little we can read from the JWT inside it.
 *
 * Pure and dependency-free on purpose: `src/proxy.ts` imports this, and proxy
 * code should not pull in `next/headers` or anything that touches React.
 *
 * ## What the claims are good for — and what they are not
 *
 * The backend signs `{ sub, role }` with a secret this app does not hold, so
 * nothing here VERIFIES the token. That is fine: the API verifies it on every
 * request, and a forged cookie buys a redirect-free page shell whose every
 * fetch 401s. The claims are only trusted for "is there a token, and has it
 * expired", which decides whether to bother rendering a protected page.
 *
 * `role` is deliberately NOT exposed. It is stamped at login, but
 * `JwtStrategy.validate` re-reads the user row on every request, so a BUYER
 * who becomes an organizer is an ORGANIZER to the API immediately while their
 * token still says BUYER for up to 24 hours. Read the role from `/auth/me`
 * (`getCurrentUser()` in `session.ts`), never from here.
 */

export const SESSION_COOKIE = "cp_session";

export interface TokenClaims {
  /** The user id. */
  sub: string;
  /** Expiry, in seconds since the epoch. */
  exp: number;
}

function decodeSegment(segment: string): unknown {
  const b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** The token's `sub` and `exp`, or null when it is not a usable JWT. */
export function readClaims(token: string): TokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = decodeSegment(parts[1]) as Partial<TokenClaims> | null;
    if (typeof payload?.sub !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    return { sub: payload.sub, exp: payload.exp };
  } catch {
    return null;
  }
}

/** Seconds until the token expires; zero or less means it already has. */
export function secondsLeft(claims: TokenClaims, now = Date.now()): number {
  return Math.floor(claims.exp - now / 1000);
}
