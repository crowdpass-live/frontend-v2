import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return <ForgotPasswordForm initialEmail={email?.trim().toLowerCase() ?? ""} />;
}
