import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDoors } from "@/lib/door";
import { formatDateTimeLong } from "@/lib/format";
import { ArrowLeftIcon } from "@/components/icons";
import { DoorConsole } from "@/components/door/DoorConsole";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Check in guests" };

/**
 * One door: the scanner, a typed code, and the guest list (#46, #47).
 *
 * Only doors this account may work are reachable — the same list `/door`
 * shows. The API enforces it on every call regardless (`assertCanScanEvent`),
 * and a grant revoked mid-shift surfaces in the console as a 403.
 */
export default async function DoorEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  await requireUser();
  const { eventId } = await params;
  const door = (await getDoors())?.find((d) => d.eventId === eventId);
  if (!door) notFound();

  return (
    <Container size="page" className="flex flex-col gap-5 py-6 sm:py-8">
      <div className="flex flex-col gap-1">
        <Link
          href={door.own ? `/host/events/${door.eventId}` : "/door"}
          className="-my-2.5 inline-flex min-h-10 w-fit items-center gap-2 text-label text-text-dim hover:text-text"
        >
          <ArrowLeftIcon width={16} height={16} /> {door.own ? "Event" : "Your doors"}
        </Link>
        <h1 className="break-words text-title font-bold text-text">{door.name}</h1>
        <p className="text-helper text-text-faint">{formatDateTimeLong(door.startTime)}</p>
      </div>
      <DoorConsole eventId={door.eventId} startTime={door.startTime} endTime={door.endTime} />
    </Container>
  );
}
