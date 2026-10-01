import { requireUser } from "@/lib/session";
import { getDoors } from "@/lib/door";
import { Mascot } from "@/components/Mascot";
import { ButtonLink, Container } from "@/components/ui";

/**
 * The `(door)` gate: anyone with at least one door to work.
 *
 * That is the backend's own rule (`CheckinAccessService.canScanEvent`): an
 * event's owner may scan it, and so may anyone holding an active
 * `EventTicketAdmin` grant. Delegates are ordinary BUYERs — there is no
 * staff role — so this is never gated on `isOrganizer` alone; and an
 * organizer needs no grant for their own events, so it is not gated on
 * grants alone either (`getDoors` merges both).
 */
export default async function DoorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  const doors = await getDoors();
  // Could not ask is not "no doors": let error.tsx offer a retry.
  if (doors === null) throw new Error("Could not load your check-in events.");

  if (doors.length === 0) {
    return (
      <Container className="flex flex-col items-center gap-5 py-24 text-center">
        <Mascot pose="no-tickets" height={120} />
        <h1 className="text-title font-bold text-text">No doors to work yet</h1>
        <p className="text-body text-text-dim">
          Your live events show up here, and so do events where an organizer
          has added you to their check-in team.
        </p>
        <ButtonLink href="/" variant="secondary" className="w-full sm:w-auto">
          Browse events
        </ButtonLink>
      </Container>
    );
  }

  return <>{children}</>;
}
