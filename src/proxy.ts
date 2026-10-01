import { NextResponse, type NextRequest } from "next/server";
import {
  NEXT_HEADER,
  SESSION_COOKIE,
  loginUrlFor,
  readClaims,
  secondsLeft,
} from "@/lib/session-token";

/**
 * Sends a signed-out visitor on a protected path to `/login?next=<path>`.
 *
 * This only checks that a cookie exists and has not expired. It does not
 * decide WHO may see a page — `(host)` needs `isOrganizer` and `(door)` needs
 * `my-checkin-events` rows, both of which take an API call and belong in the
 * route group's layout, not here. And it is not the security boundary: the
 * API checks the bearer on every request regardless.
 *
 * Route groups do not appear in URLs, so the matcher lists the real paths.
 * `/admin` is gated the same way and signs in at `/admin/login`.
 * Guest paths — `/`, `/events/*`, checkout, `/tickets/[reference]` — are
 * deliberately absent: the ticket reference is bearer-grade, and the URL is
 * the ticket.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const here = pathname + search;

  // Admin's own sign-in page has to stay reachable signed out.
  if (pathname === "/admin/login") return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? readClaims(token) : null;
  if (claims && secondsLeft(claims) > 0) {
    // Tell server code where it is, so a 401 deeper down can send the user
    // back here after they sign in again (`serverFetch`).
    const headers = new Headers(request.headers);
    headers.set(NEXT_HEADER, here);
    return NextResponse.next({ request: { headers } });
  }

  const response = NextResponse.redirect(new URL(loginUrlFor(here), request.url));
  // A dead or malformed cookie would otherwise ride along on every request.
  if (token) response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const config = {
  matcher: ["/account/:path*", "/host/:path*", "/door/:path*", "/admin/:path*"],
};
