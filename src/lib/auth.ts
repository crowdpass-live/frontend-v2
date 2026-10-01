import { ApiError, apiFetch } from "./api";
import { provisionalName } from "./names";

/**
 * The public account endpoints that issue no token, so the browser calls
 * them directly (the API's CORS allows this origin, as checkout relies on).
 * The two that DO issue a token — sign-in and email verification — go
 * through `/api/session*` instead, so the token lands in the httpOnly
 * cookie. See `session-client.ts`.
 */

/** `PASSWORD_MIN` on the backend. */
export const PASSWORD_MIN = 8;

export interface RegisterInput {
  email: string;
  password: string;
}

/**
 * `POST /auth/register`. An email signup gets NO token until the email is
 * verified (`accessToken: null`) — that is success, not failure. 409 =
 * "Email already registered".
 *
 * Email and password only, as on mobile. `RegisterDto` requires both names,
 * so the email-derived placeholder fills them; the account page asks for
 * the real name before identity verification needs it (#27).
 */
export function register(input: RegisterInput) {
  const email = input.email.trim().toLowerCase();
  return apiFetch<{ accessToken: string | null; message?: string }>("/auth/register", {
    method: "POST",
    // Only the declared fields: forbidNonWhitelisted 400s on anything else.
    body: { ...provisionalName(email), email, password: input.password },
    timeout: 45_000,
  });
}

/** `POST /auth/resend-verification` · 3/min. Never reveals whether the email exists. */
export function resendVerification(email: string) {
  return apiFetch<{ message: string }>("/auth/resend-verification", {
    method: "POST",
    body: { email: email.trim().toLowerCase() },
  });
}

/**
 * `POST /auth/forgot-password` · 3/min. Emails BOTH a link (for the web,
 * `/auth/reset-password?token=…`) and a 6-digit code (for reading the email
 * on one device and resetting on another). Never reveals whether the email
 * exists.
 */
export function forgotPassword(email: string) {
  return apiFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: { email: email.trim().toLowerCase() },
  });
}

/**
 * `POST /auth/reset-password` · 10/min. Either the link token, or the email
 * + code. There is no "check this code" endpoint, so a code is only judged
 * here, at the final submit. Issues no session: the user signs in after.
 */
export function resetPassword(
  input: { token: string; newPassword: string } | { email: string; code: string; newPassword: string },
) {
  return apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: input,
  });
}

/**
 * A throttled endpoint's message with a wait in it. The backend's
 * ThrottlerGuard answers 429 without saying for how long; these windows are
 * a minute, so say that rather than a bare "too many requests".
 */
export function describeAuthError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.status === 0) return "Couldn't reach CrowdPass. Check your connection and try again.";
  if (err.status === 429) return "Too many tries — wait a minute, then try again.";
  return err.message || fallback;
}
