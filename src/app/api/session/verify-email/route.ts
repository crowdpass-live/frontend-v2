import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, apiFetch } from "@/lib/api";
import { normalizeUser } from "@/lib/normalize";
import { startSession } from "@/lib/session";
import { errorResponse, fromApiError, requireJson } from "@/lib/route-response";

/**
 * `POST /api/session/verify-email` — `{ email, code }`.
 *
 * Email verification is a new account's first sign-in: `POST
 * /auth/verify-email` answers a correct code with an access token. So it is
 * called from HERE, server-side, like sign-in, and the token goes straight
 * into the httpOnly cookie — never through the browser.
 *
 * A wrong or expired code is the backend's 400 ("Invalid or expired
 * verification code. Request a new one."), passed through as-is. After 5
 * wrong tries the code is dead and only a resend helps.
 */

const Body = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from the email"),
});

interface VerifyResult {
  message: string;
  accessToken: string;
  user: unknown;
}

export async function POST(request: NextRequest) {
  const notJson = requireJson(request);
  if (notJson) return notJson;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(400, "Validation failed", parsed.error.issues.map((i) => i.message));
  }

  let result: VerifyResult;
  try {
    result = await apiFetch<VerifyResult>("/auth/verify-email", {
      method: "POST",
      body: parsed.data,
      cache: "no-store",
      timeout: 45_000,
    });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return fromApiError(err);
  }

  if (!(await startSession(result.accessToken))) {
    return errorResponse(502, "Your email is verified, but signing in failed. Sign in with your password.");
  }
  return NextResponse.json({ user: normalizeUser(result.user) });
}
