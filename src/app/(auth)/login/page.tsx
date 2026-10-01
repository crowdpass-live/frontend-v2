import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/session-token";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string }>;
}) {
  const { next, expired } = await searchParams;

  // Already signed in: go where they were headed. If the cookie turns out to
  // be dead, the destination's 401 path clears it and lands back here.
  if (await getSession()) redirect(safeNext(next));

  return <LoginForm next={next ? safeNext(next) : undefined} expired={expired === "1"} />;
}
