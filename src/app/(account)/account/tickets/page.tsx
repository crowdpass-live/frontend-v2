import type { Metadata } from "next";
import Link from "next/link";
import { fetchMyTickets } from "@/lib/my-tickets";
import { TICKET_STATUS } from "@/lib/ticket-status";
import { formatDate, formatTime } from "@/lib/format";
import { CoverImage } from "@/components/CoverImage";
import { Mascot } from "@/components/Mascot";
import { Pager } from "@/components/Pager";
import { ChevronRightIcon } from "@/components/icons";
import { Badge, ButtonLink, Container } from "@/components/ui";

export const metadata: Metadata = { title: "My tickets" };

/**
 * My tickets (#25). Ports `MyTicketsScreen.js`.
 *
 * A list of links, not a second ticket view: every row opens the existing
 * `/tickets/[reference]`, which already owns the QR, the mint window,
 * download and share. Server-rendered and paginated by URL.
 */
export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  const { tickets, pagination } = await fetchMyTickets(page);

  return (
    <Container size="page" className="flex flex-col gap-6 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-text">My tickets</h1>
        <p className="text-body text-text-dim">
          Every ticket bought while signed in. Open one for its QR code.
        </p>
      </header>

      {tickets.length === 0 ? (
        page > 1 ? (
          <p className="text-body text-text-dim">
            Nothing on this page.{" "}
            <Link href="/account/tickets" className="text-accent underline-offset-4 hover:underline">
              Back to the first page
            </Link>
          </p>
        ) : (
          <EmptyTickets />
        )
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {tickets.map((t) => {
            const status = TICKET_STATUS[t.status];
            const when = t.eventStart
              ? `${formatDate(t.eventStart)} · ${formatTime(t.eventStart)}`
              : "Date TBA";
            return (
              <li key={t.reference}>
                <Link
                  href={`/tickets/${encodeURIComponent(t.reference)}`}
                  className="flex items-center gap-4 rounded-card border border-border bg-surface p-3 transition-colors hover:border-border-strong hover:bg-surface-strong"
                >
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-control sm:size-20">
                    <CoverImage src={t.coverImage} sizes="80px" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-body font-bold text-text">{t.eventName}</p>
                    <p className="truncate text-helper text-text-dim">{when}</p>
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge tone={status.tone} className="shrink-0">
                        {status.label}
                      </Badge>
                      {t.tierName ? (
                        <span className="truncate text-helper text-text-faint">{t.tierName}</span>
                      ) : null}
                    </div>
                  </div>
                  <ChevronRightIcon className="shrink-0 text-text-faint" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Pager
        page={pagination.page}
        totalPages={pagination.totalPages}
        hrefFor={(p) => (p <= 1 ? "/account/tickets" : `/account/tickets?page=${p}`)}
      />
    </Container>
  );
}

function EmptyTickets() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface px-6 py-10 text-center">
      <Mascot pose="no-tickets" height={120} />
      <div className="flex flex-col gap-1">
        <h2 className="text-section font-bold text-text">No tickets yet</h2>
        <p className="text-body text-text-dim">
          Tickets you buy while signed in show up here.
        </p>
      </div>
      <ButtonLink href="/" className="w-full sm:w-auto">
        Find an event
      </ButtonLink>
    </div>
  );
}
