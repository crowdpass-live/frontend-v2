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

// --- where to send someone whose session is missing or dead ---------------

/**
 * Request header the proxy stamps with the path being rendered, so server
 * code that hits a 401 knows where to send the user back to. Server
 * components have no other reliable way to learn their own URL.
 */
export const NEXT_HEADER = "x-cp-next";

/**
 * The one place a dead session goes: clears the cookie, then redirects to
 * the right sign-in page. Both the server (`serverFetch`) and the browser
 * (`apiFetch({ auth: true })`) route every 401 through here.
 */
export const EXPIRED_PATH = "/api/session/expired";

/**
 * `next` if it is a path on this origin, else `/`.
 *
 * An unchecked `?next=` is an open redirect — a phishing link that bounces
 * through our real sign-in page to someone else's. `//evil.example` and
 * `/\evil.example` are protocol-relative to a browser, so they are refused
 * along with anything absolute. Browsers also strip tabs and newlines from a
 * URL before parsing it — `/\t/evil.example` becomes `//evil.example` — so any
 * control character or backslash is refused outright.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  for (const ch of next) {
    const code = ch.charCodeAt(0);
    if (code < 0x20 || code === 0x7f || ch === "\\") return "/";
  }
  return next;
}

/** `/admin` keeps its own sign-in page; everything else shares `/login`. */
export function loginUrlFor(next: string): string {
  const target = safeNext(next);
  const page = target.startsWith("/admin") ? "/admin/login" : "/login";
  return `${page}?next=${encodeURIComponent(target)}`;
}

export function expiredUrlFor(next: string): string {
  return `${EXPIRED_PATH}?next=${encodeURIComponent(safeNext(next))}`;
}
