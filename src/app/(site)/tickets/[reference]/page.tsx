import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { fetchTicketByReference } from "@/lib/crowdpass";
import { formatDate, formatDateTimeLong, formatTime, money } from "@/lib/format";
import { CalendarIcon, PinIcon } from "@/components/icons";
import { Badge, ButtonLink, Card, Container } from "@/components/ui";
import { TicketCredential } from "@/components/TicketCredential";
import { Celebration } from "@/components/Celebration";
import { Mascot } from "@/components/Mascot";
import type { ApiTicket, TicketStatus } from "@/types/api";

type Params = { reference: string };
type Search = { celebrate?: string };

export const metadata: Metadata = {
  title: "Your ticket",
  // The reference is bearer-grade — it's the only key a guest buyer holds.
  // Keep the page out of search indexes and out of referrer headers.
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

const STATUS: Record<
  TicketStatus,
  { label: string; tone: "ok" | "warn" | "info" | "danger" | "neutral"; note: string }
> = {
  CONFIRMED: {
    label: "Valid",
    tone: "ok",
    // Only used by the non-CONFIRMED branch below; TicketCredential owns the
    // confirmed case, including the wait before the QR is minted.
    note: "Show this at the door.",
  },
  PENDING: {
    label: "Pending payment",
    tone: "warn",
    note: "We're still waiting on your payment. This ticket becomes valid the moment it clears.",
  },
  USED: {
    label: "Checked in",
    tone: "info",
    note: "This ticket has already been scanned at the door.",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "danger",
    note: "This ticket was cancelled and cannot be used for entry.",
  },
  REFUNDED: {
    label: "Refunded",
    tone: "danger",
    note: "This ticket was refunded and cannot be used for entry.",
  },
};

export default async function TicketPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { reference } = await params;
  // Set only by the payment-result page, so the burst fires once on arrival
  // from checkout and never again on a revisit or a refresh.
  const { celebrate } = await searchParams;
  const justPaid = celebrate === "1";

  let ticket: ApiTicket;
  try {
    ticket = await fetchTicketByReference(reference);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const status = STATUS[ticket.status] ?? STATUS.PENDING;
  const event = ticket.event;
  const where = [event.venue, event.location].filter(Boolean).join(", ");
  // A confirmed ticket gets the credential panel — which renders the QR when
  // it exists and waits for the mint when it does not. Anything else (pending
  // payment, cancelled, refunded, already used) gets a plain status note;
  // rendering a QR for a refunded ticket invites an argument at the door.
  const isConfirmed = ticket.status === "CONFIRMED";

  // Absolute, because it is handed to WhatsApp and the native share sheet.
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.crowdpazz.com"
  ).replace(/\/+$/, "");
  const shareUrl = `${siteUrl}/tickets/${encodeURIComponent(ticket.reference)}`;

  return (
    <main className="flex flex-1 flex-col py-8 lg:py-16">
      {justPaid && isConfirmed ? <Celebration /> : null}

      <Container className="flex flex-col gap-6">
        {justPaid && isConfirmed ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <Mascot pose="success" height={150} />
            <h1 className="text-display font-bold text-text">You&apos;re in</h1>
            <p className="max-w-sm text-body text-text-dim">
              Your ticket is confirmed. Save it or send it to whoever is coming
              with you.
            </p>
          </div>
        ) : (
          <header className="flex items-center justify-between gap-4">
            <h1 className="text-title font-bold text-text">Your ticket</h1>
            <Badge tone={status.tone}>{status.label}</Badge>
          </header>
        )}

        <Card className={`overflow-hidden ${justPaid ? "ticket-enter" : ""}`}>
          <div className="flex flex-col gap-1 p-5">
            <p className="text-section font-bold text-text text-balance">
              {event.name}
            </p>
            <p className="text-label text-text-dim">{ticket.ticketType.name}</p>
          </div>

          {isConfirmed ? (
            <TicketCredential
              reference={ticket.reference}
              initialToken={ticket.qrCode}
              eventName={event.name}
              tierName={ticket.ticketType.name}
              whenLabel={`${formatDate(event.startTime)} · ${formatTime(event.startTime)}`}
              whereLabel={where}
              holder={ticket.buyerName ?? ""}
              shareUrl={shareUrl}
            />
          ) : (
            <div className="border-t border-border p-5">
              <p className="text-body text-text-dim">{status.note}</p>
              <p className="mt-3 font-mono text-label text-text">
                {ticket.reference}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-border p-5">
            <div className="flex items-start gap-3">
              <CalendarIcon className="mt-0.5 shrink-0 text-accent" />
              <p className="text-label text-text">
                {formatDateTimeLong(event.startTime)}
              </p>
            </div>
            {where ? (
              <div className="flex items-start gap-3">
                <PinIcon className="mt-0.5 shrink-0 text-accent" />
                <p className="text-label text-text">{where}</p>
              </div>
            ) : null}
          </div>

          <dl className="divide-y divide-border border-t border-border">
            <Row label="Ticket holder" value={ticket.buyerName || "—"} />
            <Row
              label="Price"
              value={money(ticket.ticketType.price, "NGN")}
            />
            {ticket.tokenId ? (
              <Row label="NFT token" value={`#${ticket.tokenId}`} />
            ) : null}
          </dl>
        </Card>

        <ButtonLink
          href={`/events/${event.slug}`}
          variant="secondary"
          className="w-full"
        >
          View event
        </ButtonLink>
      </Container>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className="shrink-0 text-label text-text-faint">{label}</dt>
      <dd className="min-w-0 truncate text-label font-medium text-text">
        {value}
      </dd>
    </div>
  );
}
