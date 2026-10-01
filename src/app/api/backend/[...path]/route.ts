import { NextResponse, type NextRequest } from "next/server";
import { API_BASE } from "@/lib/api";
import { getSession } from "@/lib/session";

/**
 * `/api/backend/<path>` — forwards a browser request to `<API_BASE>/<path>`
 * with the session's bearer token attached.
 *
 * This is how a client component makes an authenticated call without the JWT
 * ever reaching client JavaScript: the browser sends the httpOnly cookie to
 * us, we swap it for an `Authorization` header. Use it through
 * `apiFetch(path, { auth: true })`, never directly.
 *
 * The response is passed through untouched — status, body, `Content-Type`,
 * `Content-Disposition` — rather than unwrapped here. `apiFetch` does the
 * envelope unwrap on the client as it always has, and the `@SkipTransform`
 * CSV export (#41) arrives as the raw file it is.
 *
 * It grants nothing the user's own token does not: the API checks every
 * request. The one thing it must not do is let another site spend that
 * token, so any non-GET has to come from this origin.
 */

/** Long enough for publish (#39), which waits on an on-chain leg. */
const TIMEOUT_MS = 60_000;

const PASS_REQUEST = ["accept", "content-type"];
const PASS_RESPONSE = ["content-type", "content-disposition", "retry-after"];

function error(status: number, message: string) {
  return NextResponse.json({ statusCode: status, message }, { status });
}

async function forward(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const method = request.method;

  if (method !== "GET" && method !== "HEAD") {
    // SameSite=Lax already keeps the cookie off cross-site POSTs; this also
    // refuses a same-site-but-foreign origin (another *.vercel.app preview).
    const origin = request.headers.get("origin");
    if (origin !== request.nextUrl.origin) {
      return error(403, "Cross-origin request refused.");
    }
  }

  const { path } = await params;
  if (path.some((seg) => seg === "." || seg === "..")) {
    return error(400, "Invalid path.");
  }

  const session = await getSession();
  if (!session) return error(401, "Your session has ended. Please sign in again.");

  const target = `${API_BASE}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;

  const headers = new Headers({ Authorization: `Bearer ${session.accessToken}` });
  for (const name of PASS_REQUEST) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    return error(504, "Could not reach CrowdPass. Please check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  const out = new Headers({ "Cache-Control": "no-store" });
  for (const name of PASS_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers: out });
}

export {
  forward as GET,
  forward as POST,
  forward as PUT,
  forward as PATCH,
  forward as DELETE,
};
