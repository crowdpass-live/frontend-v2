import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ArrowLeftIcon } from "@/components/icons";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Event" };

/**
 * Placeholder for the event control room. Analytics (#40), the attendee
 * roster (#41) and payouts (#44) land here next; until then the dashboard's
 * cards still have somewhere honest to go.
 */
export default async function HostEventPage() {
  await requireUser();
  return (
    <Container size="page" className="flex flex-col gap-4 py-8">
      <Link
        href="/host"
        className="inline-flex w-fit items-center gap-2 text-label text-text-dim hover:text-text"
      >
        <ArrowLeftIcon width={16} height={16} /> Dashboard
      </Link>
      <h1 className="text-title font-bold text-text">Event control room</h1>
      <p className="text-body text-text-dim">
        Sales analytics, the attendee list and payouts for this event are on
        their way.
      </p>
    </Container>
  );
}
