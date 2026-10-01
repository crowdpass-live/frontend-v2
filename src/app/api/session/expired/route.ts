import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, loginUrlFor } from "@/lib/session-token";

/**
 * `GET /api/session/expired?next=<path>` — the single 401 path.
 *
 * There is no refresh token, so a 401 from the API always means "sign in
 * again". Server components cannot delete cookies while rendering, and a
 * page full of client queries would otherwise each redirect on its own, so
 * both sides send the user here instead: one cookie deletion, one redirect.
 *
 * A GET with a side effect is deliberate — it has to be reachable from a
 * server-side `redirect()`. The worst a forged link can do is sign someone
 * out, which they can undo by signing in.
 */
export function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  const url = new URL(loginUrlFor(next), request.url);
  url.searchParams.set("expired", "1");
  const response = NextResponse.redirect(url);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
