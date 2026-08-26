import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { fetchEventBySlug } from "@/lib/crowdpass";
import { formatDate, saleWindow } from "@/lib/format";
import { CheckoutForm } from "./CheckoutForm";
import { ArrowLeftIcon } from "@/components/icons";
import { ButtonLink, Card, Shell } from "@/components/ui";

type Params = { slug: string };

export const metadata: Metadata = {
  title: "Checkout",
  // A checkout URL in a search index is noise at best; at worst it is a stale
  // price. Keep it out.
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  let event;
  try {
    event = await fetchEventBySlug(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // Refuse to render a checkout that cannot complete. Letting the buyer fill
  // in their details and only then discovering the sale is closed — because
  // the backend rejects the purchase — wastes the one moment they were
  // willing to pay.
  const { canBuy, reason } = saleWindow(event);
  const blocked = canBuy ? null : `${reason}.`;

  return (
    <main className="flex flex-1 flex-col pb-40">
      <Shell className="flex flex-col gap-8 pt-6">
        <header className="flex items-center gap-3">
          <Link
            href={`/events/${event.slug}`}
            aria-label="Back to event"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-text transition-colors hover:bg-surface-strong"
          >
            <ArrowLeftIcon />
          </Link>
          <h1 className="text-title font-bold text-text">Checkout</h1>
        </header>

        <div>
          <p className="text-title font-bold text-text-dim text-balance">
            {event.name}
          </p>
          <p className="mt-1 text-label text-text-faint">
            {formatDate(event.startTime)}
            {event.venue ? ` · ${event.venue}` : ""}
          </p>
        </div>

        {blocked ? (
          <div className="flex flex-col gap-4">
            <Card className="p-5 text-body text-text-dim">{blocked}</Card>
            <ButtonLink
              href={`/events/${event.slug}`}
              variant="secondary"
              className="w-full"
            >
              Back to event
            </ButtonLink>
          </div>
        ) : (
          <CheckoutForm event={event} />
        )}
      </Shell>
    </main>
  );
}
