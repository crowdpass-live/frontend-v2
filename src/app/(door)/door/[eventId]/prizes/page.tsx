import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getDoors } from "@/lib/door";
import { getSpinCampaignForEvent } from "@/lib/spin-wheel-server";
import { ArrowLeftIcon } from "@/components/icons";
import { PrizeDesk } from "@/components/spin/PrizeDesk";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Prize desk" };

/**
 * The spin-the-wheel booth for one event. Same people as the door: the event's
 * owner and its check-in team. The API checks that on every call regardless.
 */
export default async function PrizeDeskPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  await requireUser();
  const { eventId } = await params;
  const door = (await getDoors())?.find((d) => d.eventId === eventId);
  if (!door) notFound();
  const campaign = await getSpinCampaignForEvent(eventId);
  if (!campaign) notFound();

  return (
    <Container size="page" className="flex flex-col gap-5 py-6 sm:py-8">
      <div className="flex flex-col gap-1">
        <Link
          href={`/door/${eventId}`}
          className="-my-2.5 inline-flex min-h-10 w-fit items-center gap-2 text-label text-text-dim hover:text-text"
        >
          <ArrowLeftIcon width={16} height={16} /> Door
        </Link>
        <h1 className="break-words text-title font-bold text-text">Prize desk</h1>
        <p className="text-helper text-text-faint">
          {door.name} · players spin at /spin/{campaign.event.slug}
        </p>
      </div>
      <PrizeDesk campaignId={campaign.id} />
    </Container>
  );
}
