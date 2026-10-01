import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readClaims, secondsLeft } from "@/lib/session-token";

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
 * Guest paths — `/`, `/events/*`, checkout, `/tickets/[reference]` — are
 * deliberately absent: the ticket reference is bearer-grade, and the URL is
 * the ticket.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? readClaims(token) : null;
  if (claims && secondsLeft(claims) > 0) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);

  const response = NextResponse.redirect(login);
  // A dead or malformed cookie would otherwise ride along on every request.
  if (token) response.cookies.delete(SESSION_COOKIE);
  return response;
}

export const config = {
  matcher: ["/account/:path*", "/host/:path*", "/door/:path*"],
};
