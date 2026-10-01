import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { Card, Container } from "@/components/ui";

export const metadata: Metadata = { title: "Account" };

/** Placeholder until my tickets (#25) and the profile page (#26) land. */
export default async function AccountPage() {
  const user = await requireUser();
  return (
    <Container className="flex flex-col gap-4 py-10">
      <h1 className="text-title font-bold text-text">Your account</h1>
      <Card className="flex flex-col gap-1 px-5 py-4">
        <p className="text-body font-bold text-text">{user.name}</p>
        {user.email ? <p className="text-label text-text-dim">{user.email}</p> : null}
        {user.phone ? <p className="text-label text-text-dim">{user.phone}</p> : null}
      </Card>
      <p className="text-label text-text-faint">
        Your tickets and profile settings are coming to the web soon.
      </p>
    </Container>
  );
}
