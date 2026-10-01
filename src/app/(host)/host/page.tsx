import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

/** Placeholder until the organizer dashboard (#36) lands here. */
export default async function HostHomePage() {
  const user = await requireUser();
  return (
    <Container size="page" className="flex flex-col gap-3 py-10">
      <h1 className="text-title font-bold text-text">
        Welcome back{user.firstName ? `, ${user.firstName}` : ""}.
      </h1>
      <p className="text-body text-text-dim">
        Your events, ticket sales and payouts will show up here.
      </p>
    </Container>
  );
}
