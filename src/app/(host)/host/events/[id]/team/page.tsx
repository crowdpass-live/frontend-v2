import type { Metadata } from "next";
import { ApiError } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { fetchEventAnalytics, fetchTicketAdmins, settle } from "@/lib/organizer";
import { CheckInTeam } from "@/components/host/CheckInTeam";

export const metadata: Metadata = { title: "Check-in team" };

/**
 * The check-in team (#48): who may scan tickets at this event's door.
 * Ports `CheckInTeamScreen.js`.
 *
 * A delegate is any CrowdPass account — usually a plain BUYER, a friend
 * handed a phone for the evening — and gets NO organizer access: they see
 * this event under "At the door" and nothing else. Granting writes the
 * on-chain ticketAdmin role for every ticket type, which is why it needs a
 * published event and takes a few seconds.
 */
export default async function HostEventTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [event, team] = await Promise.all([
    settle(fetchEventAnalytics(id)),
    settle(fetchTicketAdmins(id)),
  ]);
  // The layout renders the 404 / not-yours state.
  if (!event.ok) return null;
  if (!team.ok) {
    if (team.error instanceof ApiError && team.error.status === 403) {
      return (
        <p className="rounded-card border border-dashed border-border px-5 py-10 text-center text-label text-text-faint">
          Only the event&apos;s organizer can manage its check-in team.
        </p>
      );
    }
    throw team.error;
  }

  return (
    <CheckInTeam
      eventId={id}
      eventStatus={event.value.event.status}
      selfId={user.id}
      initial={team.value}
    />
  );
}
