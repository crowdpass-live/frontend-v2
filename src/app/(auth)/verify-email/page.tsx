import type { Metadata } from "next";
import { safeNext } from "@/lib/session-token";
import { VerifyEmailForm } from "./VerifyEmailForm";

export const metadata: Metadata = { title: "Verify your email", robots: { index: false } };

/**
 * `/verify-email?email=…&sent=1&next=…`. `sent=1` means a code was emailed
 * moments ago (straight after sign-up), so the resend button starts on its
 * cooldown. Not gated on a session: verifying IS how a new account gets one.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; sent?: string; next?: string }>;
}) {
  const { email, sent, next } = await searchParams;
  return (
    <VerifyEmailForm
      initialEmail={email?.trim().toLowerCase() ?? ""}
      justSent={sent === "1"}
      next={next ? safeNext(next) : undefined}
    />
  );
}
