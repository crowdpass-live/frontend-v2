import { getDoorEvents, requireUser } from "@/lib/session";
import { Mascot } from "@/components/Mascot";
import { ButtonLink, Container } from "@/components/ui";

/**
 * The `(door)` gate — the most-missed rule in the port.
 *
 * Check-in staff are ordinary BUYER accounts holding an `EventTicketAdmin`
 * grant; there is no staff role. So the door is open to whoever
 * `my-checkin-events` returns rows for, and is NEVER gated on `isOrganizer` —
 * that would lock out exactly the people it exists for.
 */
export default async function DoorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  const doors = await getDoorEvents();
  // Could not ask is not "no doors": let error.tsx offer a retry.
  if (doors === null) throw new Error("Could not load your check-in events.");

  if (doors.length === 0) {
    return (
      <Container className="flex flex-col items-center gap-5 py-24 text-center">
        <Mascot pose="no-tickets" height={120} />
        <h1 className="text-title font-bold text-text">No doors to work yet</h1>
        <p className="text-body text-text-dim">
          When an organizer adds you to their check-in team, their event shows
          up here and you can start letting guests in.
        </p>
        <ButtonLink href="/" variant="secondary" className="w-full sm:w-auto">
          Browse events
        </ButtonLink>
      </Container>
    );
  }

  return <>{children}</>;
}
