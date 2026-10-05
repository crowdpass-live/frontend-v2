import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { fetchEventAnalytics, settle } from "@/lib/organizer";
import { formatDate } from "@/lib/format";
import { ArrowLeftIcon } from "@/components/icons";
import { DraftBar } from "@/components/host/DraftBar";
import { EventTabs } from "@/components/host/EventTabs";
import { Badge, Container } from "@/components/ui";
import type { EventStatus } from "@/types/api";

const STATUS: Record<EventStatus, { label: string; tone: "ok" | "neutral" | "info" | "danger" }> = {
  PUBLISHED: { label: "Live", tone: "ok" },
  DRAFT: { label: "Draft", tone: "neutral" },
  COMPLETED: { label: "Ended", tone: "info" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

/**
 * One event's control room: its name and status, then the sections.
 *
 * The analytics read doubles as the access check — the API answers 404 for
 * an unknown id and 403 for someone else's event (an admin may see any).
 * Pages below repeat the read through the same per-request cache, and they
 * handle auth themselves; this layout is not the gate.
 */
export default async function HostEventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await settle(fetchEventAnalytics(id));

  if (!result.ok) {
    const err = result.error;
    // A malformed id fails ParseUUIDPipe-style validation as a 400.
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    if (err instanceof ApiError && err.status === 403) return <NotYours />;
    throw err;
  }

  const { event } = result.value;
  const status = STATUS[event.status] ?? { label: event.status, tone: "neutral" as const };

  return (
    <Container size="page" className="flex flex-col gap-6 py-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/host"
          className="-my-2.5 inline-flex min-h-10 w-fit items-center gap-2 text-label text-text-dim hover:text-text"
        >
          <ArrowLeftIcon width={16} height={16} /> Dashboard
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="min-w-0 break-words text-title font-bold text-text">{event.name}</h1>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="text-label text-text-faint">{formatDate(event.startTime)}</p>
      </div>
      {event.status === "DRAFT" ? <DraftBar eventId={event.id} /> : null}
      <EventTabs eventId={event.id} />
      {children}
    </Container>
  );
}

function NotYours() {
  return (
    <Container className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-title font-bold text-text">Not your event</h1>
      <p className="text-body text-text-dim">
        This event belongs to another organizer, so its sales and attendees
        aren&apos;t yours to see.
      </p>
      <Link href="/host" className="text-body font-bold text-accent hover:text-accent-hi">
        Back to your dashboard
      </Link>
    </Container>
  );
}
