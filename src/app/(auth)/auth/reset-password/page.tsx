import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
  // The URL carries a live reset token; keep it out of Referer headers.
  referrer: "no-referrer",
};

/**
 * `/auth/reset-password` — the exact path the backend's reset email links
 * to (`${APP_URL}/auth/reset-password?token=…`; APP_URL must be this site).
 *
 * `?token=` → the link path: just a new password. No token → the code path
 * (email + 6-digit code + new password), for someone who read the email on
 * another device.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const { token, email } = await searchParams;
  const cleanToken = token && /^[0-9a-f]{16,128}$/i.test(token) ? token : undefined;
  return (
    <ResetPasswordForm
      token={cleanToken}
      badToken={!!token && !cleanToken}
      initialEmail={email?.trim().toLowerCase() ?? ""}
    />
  );
}
