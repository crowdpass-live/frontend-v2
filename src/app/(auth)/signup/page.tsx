import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/session-token";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getSession()) redirect(safeNext(next));
  return <SignupForm next={next ? safeNext(next) : undefined} />;
}
