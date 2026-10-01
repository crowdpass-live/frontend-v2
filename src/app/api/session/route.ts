import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError, apiFetch } from "@/lib/api";
import { startSession } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/session-token";
import { errorResponse, fromApiError, requireJson } from "@/lib/route-response";
import { normalizeUser } from "@/lib/normalize";
import type { LoginResult } from "@/types/api";

/**
 * `POST /api/session` signs in; `DELETE /api/session` signs out.
 *
 * The sign-in call to the API happens HERE, server-side, rather than in the
 * browser with the token posted back to us. That way the JWT goes API → this
 * handler → httpOnly cookie and never exists in client JavaScript at all, not
 * even for the length of one request.
 *
 * Errors keep the backend's shape (`{ statusCode, message, errors? }`) and
 * status, so the client can tell a 401 (bad credentials) from a 403 (email
 * not verified — not a wrong password, and must not be shown as one).
 */

const SignIn = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Enter a valid email address")
      .optional(),
    phone: z.string().trim().min(1).optional(),
    password: z.string().min(1, "Enter your password"),
  })
  .refine((b) => b.email || b.phone, {
    message: "Provide an email address or a phone number to sign in",
  });

export async function POST(request: NextRequest) {
  const notJson = requireJson(request);
  if (notJson) return notJson;

  const parsed = SignIn.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(
      400,
      "Validation failed",
      parsed.error.issues.map((i) => i.message),
    );
  }

  // Forward only the fields LoginDto declares: the API runs with
  // `forbidNonWhitelisted`, so one stray key 400s the whole request.
  const { email, phone, password } = parsed.data;

  let result: LoginResult;
  try {
    result = await apiFetch<LoginResult>("/auth/login", {
      method: "POST",
      body: { ...(email ? { email } : { phone }), password },
      cache: "no-store",
      // Render cold starts; same allowance the admin login always had.
      timeout: 45_000,
    });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    // Status 0 means we never reached the API: a gateway problem, not the
    // user's credentials — fromApiError maps it to 504.
    return fromApiError(err);
  }

  if (!(await startSession(result.accessToken))) {
    return errorResponse(502, "Sign-in returned an unusable session. Please try again.");
  }

  // The same SessionUser shape /auth/me produces (minus profile and wallets,
  // which login does not carry) — and never the token.
  return NextResponse.json({ user: normalizeUser(result.user) });
}

export async function DELETE() {
  // Purely local: the backend has no logout, so the JWT itself stays valid
  // until it expires. Dropping our only copy of it is all we can do.
  (await cookies()).delete(SESSION_COOKIE);
  return new NextResponse(null, { status: 204 });
}
