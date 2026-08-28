import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { fetchEventBySlug, fetchPaymentMethods } from "@/lib/crowdpass";
import {
  chainName,
  formatDate,
  formatTime,
  money,
  saleWindow,
  titleCase,
} from "@/lib/format";
import { EventCover } from "@/components/EventCover";
import { CalendarIcon, PinIcon } from "@/components/icons";
import { Badge, ButtonLink, Card, SectionTitle, Container } from "@/components/ui";
import type { ApiEvent, ApiTicketType } from "@/types/api";

type Params = { slug: string };

/**
 * Server-rendered: this is the page a flyer QR code and a WhatsApp link both
 * land on, so it has to paint fast on 4G and be scrapeable for the link
 * preview that sells the event in the chat.
 */
async function getEvent(slug: string): Promise<ApiEvent> {
  try {
    return await fetchEventBySlug(slug);
  } catch (err) {
    // 404 is the ordinary case (bad link, unpublished, cancelled). Anything
    // else is a real outage and should surface as a 500 rather than be
    // disguised as a missing event.
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  let event: ApiEvent;
  try {
    event = await fetchEventBySlug(slug);
  } catch {
    return { title: "Event" };
  }

  const where = [event.venue, event.location].filter(Boolean).join(", ");
  const description =
    event.description?.slice(0, 160) ||
    `${formatDate(event.startTime)}${where ? ` · ${where}` : ""}. Get your ticket on CrowdPass.`;

  return {
    title: event.name,
    description,
    openGraph: {
      title: event.name,
      description,
      type: "website",
      images: event.coverImage ? [{ url: event.coverImage }] : undefined,
    },
    twitter: {
      card: event.coverImage ? "summary_large_image" : "summary",
      title: event.name,
      description,
    },
  };
}

/** The cheapest tier a buyer could actually buy, for the "from ₦X" footer. */
function priceFrom(tiers: ApiTicketType[]): number | null {
  const buyable = tiers.filter((t) => t.isOnSale);
  const pool = buyable.length ? buyable : tiers;
  if (!pool.length) return null;
  return Math.min(...pool.map((t) => Number(t.price) || 0));
}

/**
 * The sub-line under a tier name. Mirrors the design's `42 left · max
 * 4/person`, but degrades honestly: a sold-out or not-yet-open tier says so
 * instead of advertising a count the buyer can't act on.
 */
function tierNote(tier: ApiTicketType): string {
  if (tier.available <= 0) return "Sold out";
  if (!tier.isOnSale) return "Not on sale";
  const parts = [`${tier.available} left`];
  if (tier.maxPerUser > 0) parts.push(`max ${tier.maxPerUser}/person`);
  return parts.join(" · ");
}

function TicketTierRow({
  tier,
  currency,
}: {
  tier: ApiTicketType;
  currency: string;
}) {
  const unavailable = !tier.isOnSale;
  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <p
          className={`truncate text-body font-semibold ${
            unavailable ? "text-text-faint" : "text-text"
          }`}
        >
          {tier.name}
        </p>
        <p className="mt-0.5 text-helper text-text-faint">{tierNote(tier)}</p>
      </div>
      <p
        className={`shrink-0 text-body font-bold ${
          unavailable ? "text-text-faint line-through" : "text-text"
        }`}
      >
        {money(tier.price, currency)}
      </p>
    </Card>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <span className="text-body text-text-dim">{label}</span>
      <span className="flex items-center gap-2 text-label font-medium text-text">
        {children}
      </span>
    </div>
  );
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const event = await getEvent(slug);

  // Which rails this organizer can actually take money on. Fetched rather
  // than assumed: `acceptsCrypto` is an event flag, but whether card payment
  // is offered depends on the organizer having completed a real gateway
  // subaccount — and promising "Card" here when checkout can only do crypto
  // is a promise the next page breaks.
  const methods = await fetchPaymentMethods(event.id).catch(() => null);

  const currency = event.currency || "NGN";
  const tiers = event.ticketTypes ?? [];
  const from = priceFrom(tiers);

  // Shared with the checkout page so the CTA here can never promise something
  // the next page refuses.
  const { canBuy, reason: blockedReason } = saleWindow(event);

  const where = [event.venue, event.location].filter(Boolean);
  const organizer = [event.organizer?.firstName, event.organizer?.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    // `pb-32` clears the fixed mobile purchase bar; from `lg` the bar is gone
    // and the padding with it.
    <main className="flex flex-1 flex-col pb-32 lg:pb-16">
      {/* Full-bleed on a phone, an inset rounded hero once there is a page
       * around it — a cover running edge-to-edge on a 1440px monitor reads as
       * a banner ad rather than as part of the page. */}
      <Container size="page" className="px-0 sm:px-6 lg:px-8 lg:pt-8">
        <EventCover
          src={event.coverImage}
          title={event.name}
          category={titleCase(event.category)}
        />
      </Container>

      <Container
        size="page"
        className="grid grid-cols-1 gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-12 lg:pt-12"
      >
        <div className="flex flex-col gap-8 lg:gap-10">
        {/* When + where */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-control bg-surface text-accent">
              <CalendarIcon />
            </span>
            <div>
              <p className="text-body font-semibold text-text">
                {formatDate(event.startTime)}
              </p>
              <p className="text-label text-text-dim">
                {formatTime(event.startTime)}
                {event.endTime ? ` – ${formatTime(event.endTime)}` : ""}
              </p>
            </div>
          </div>

          {where.length > 0 ? (
            <div className="flex items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-control bg-surface text-accent">
                <PinIcon />
              </span>
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-text">
                  {where[0]}
                </p>
                {where[1] ? (
                  <p className="truncate text-label text-text-dim">{where[1]}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        {event.description ? (
          <section className="flex flex-col gap-3">
            <SectionTitle>About</SectionTitle>
            {/* Descriptions are authored as plain text by organizers. Rendered
             * as text, never as HTML — an organizer-controlled string injected
             * into the buyer's page is a stored XSS on the payment flow. */}
            <p className="whitespace-pre-line text-body text-text-dim">
              {event.description}
            </p>
          </section>
        ) : null}

        {/* Good to know */}
        <section className="flex flex-col gap-3">
          <SectionTitle>Good to know</SectionTitle>
          <Card className="divide-y divide-border">
            <InfoRow label="Ticket">
              NFT{event.chain ? ` · ${chainName(event.chain)}` : ""}
            </InfoRow>
            <InfoRow label="Payment">
              {/* No methods resolved (the lookup failed) falls back to the
               * event's own flags rather than showing an empty row. */}
              {methods ? (
                <>
                  {methods.fiat ? <Badge>Card</Badge> : null}
                  {methods.crypto
                    ? methods.crypto.tokens
                        .slice(0, 2)
                        .map((token) => (
                          <Badge key={token} tone="accent">
                            {token}
                          </Badge>
                        ))
                    : null}
                  {!methods.fiat && !methods.crypto ? (
                    <span className="text-text-faint">Not yet available</span>
                  ) : null}
                </>
              ) : (
                <>
                  <Badge>Card</Badge>
                  {event.acceptsCrypto ? <Badge tone="accent">USDC</Badge> : null}
                </>
              )}
            </InfoRow>
            <InfoRow label="Refunds">
              {event.isRefundable ? "Refundable" : "Non-refundable"}
            </InfoRow>
            {organizer ? <InfoRow label="Organizer">{organizer}</InfoRow> : null}
          </Card>
        </section>
        </div>

        {/* Ticket rail. In the flow on a phone (below the details, above the
         * fixed bar); a sticky sidebar from `lg`, where the buyer can read the
         * description and still see prices and the CTA without scrolling. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <section className="flex flex-col gap-3">
            <SectionTitle>Tickets</SectionTitle>
            {tiers.length === 0 ? (
              <Card className="p-4 text-body text-text-dim">
                No tickets have been published for this event yet.
              </Card>
            ) : (
              tiers.map((tier) => (
                <TicketTierRow key={tier.id} tier={tier} currency={currency} />
              ))
            )}
          </section>

          {/* The desktop CTA. Hidden below `lg`, where the fixed bar owns it —
           * two visible "Get tickets" buttons on one screen is a worse answer
           * than one in the right place for each layout. */}
          <div className="hidden lg:flex lg:flex-col lg:gap-3">
            {canBuy ? (
              <>
                <ButtonLink
                  href={`/events/${event.slug}/checkout`}
                  className="w-full"
                >
                  Get tickets
                </ButtonLink>
                <p className="text-center text-helper text-text-faint">
                  {from !== null ? `From ${money(from, currency)} · ` : ""}
                  No account needed
                </p>
              </>
            ) : (
              <span className="inline-flex h-14 w-full items-center justify-center rounded-control bg-surface px-6 text-body font-bold text-text-faint">
                {blockedReason}
              </span>
            )}
          </div>
        </aside>
      </Container>

      {/* Mobile purchase bar. Fixed rather than in-flow so it survives a long
       * description without the buyer having to scroll back for the CTA. The
       * desktop equivalent is the sticky rail above. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur lg:hidden">
        <Container className="flex items-center gap-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-helper text-text-faint">Tickets</p>
            <p className="truncate text-body font-bold text-text">
              {canBuy && from !== null ? `from ${money(from, currency)}` : blockedReason}
            </p>
          </div>
          {canBuy ? (
            <ButtonLink
              href={`/events/${event.slug}/checkout`}
              className="min-w-[168px]"
            >
              Get tickets
            </ButtonLink>
          ) : (
            <span className="inline-flex h-14 min-w-[168px] items-center justify-center rounded-control bg-surface px-6 text-body font-bold text-text-faint">
              Unavailable
            </span>
          )}
        </Container>
      </div>
    </main>
  );
}
