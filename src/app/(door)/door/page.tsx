import type { Metadata } from "next";
import { getDoorEvents, requireUser } from "@/lib/session";
import { Card, Container } from "@/components/ui";

export const metadata: Metadata = { title: "Check-in" };

/**
 * Placeholder until the delegate's event list (#45) lands here.
 *
 * Checks the session itself rather than trusting the layout: a page renders
 * in parallel with its layout, and a redirect thrown only from the layout
 * surfaces as a 500 instead of a clean 307. Every gated page does this.
 */
export default async function DoorHomePage() {
  await requireUser();
  const doors = (await getDoorEvents()) ?? [];
  return (
    <Container className="flex flex-col gap-4 py-10">
      <h1 className="text-title font-bold text-text">Your doors</h1>
      <ul className="flex flex-col gap-3">
        {doors.map((d) => (
          <li key={d.eventId}>
            <Card className="px-5 py-4">
              <p className="text-body font-bold text-text">{d.name}</p>
              <p className="text-helper text-text-faint">{d.organizerName}</p>
            </Card>
          </li>
        ))}
      </ul>
    </Container>
  );
}
