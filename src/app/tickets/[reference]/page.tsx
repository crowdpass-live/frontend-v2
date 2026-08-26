import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { fetchTicketByReference } from "@/lib/crowdpass";
import { formatDateTimeLong, money } from "@/lib/format";
import { CalendarIcon, PinIcon } from "@/components/icons";
import { Badge, ButtonLink, Card, Container } from "@/components/ui";
import { Logo } from "@/components/Logo";
import type { ApiTicket, TicketStatus } from "@/types/api";

type Params = { reference: string };

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
    note: "Show this QR code at the door.",
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
}: {
  params: Promise<Params>;
}) {
  const { reference } = await params;

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
  // Only a confirmed, unused ticket has a QR worth showing. Rendering one for
  // a refunded ticket invites an argument at the door.
  const showQr = ticket.status === "CONFIRMED" && !!ticket.qrCode;

  return (
    <main className="flex flex-1 flex-col py-8 lg:py-16">
      <Container className="flex flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <h1 className="text-title font-bold text-text">Your ticket</h1>
          <Badge tone={status.tone}>{status.label}</Badge>
        </header>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-1 p-5">
            <p className="text-section font-bold text-text text-balance">
              {event.name}
            </p>
            <p className="text-label text-text-dim">{ticket.ticketType.name}</p>
          </div>

          {showQr ? (
            <div className="flex flex-col items-center gap-4 border-t border-border bg-white px-5 py-6 sm:py-8">
              {/* On white, deliberately: a QR needs light quiet-zone contrast
               * to scan reliably, and the scanner has under 2s to read it. */}
              <Image
                src={ticket.qrCode!}
                alt={`QR code for ticket ${ticket.reference}`}
                width={220}
                height={220}
                unoptimized
                className="size-[220px] object-contain"
              />
              <p className="font-mono text-label font-bold tracking-wide text-accent-deep">
                {ticket.reference}
              </p>
              {/* The mark on the white stub, the way a printed ticket carries
               * the venue's. The mark is orange artwork rather than type, so
               * it is fine on white — the *text* on this panel uses
               * `accent-deep`, because the brand orange only clears ~3:1
               * against white. */}
              <Logo variant="mark" height={16} className="opacity-70" />
            </div>
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

        {showQr ? (
          <p className="text-center text-helper text-text-faint">
            Screenshot this or keep the link handy — it works offline at the
            door.
          </p>
        ) : null}

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
