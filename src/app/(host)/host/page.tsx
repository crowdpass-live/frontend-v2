import type { Metadata } from "next";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { requireUser } from "@/lib/session";
import {
  EVENT_STATUSES,
  ORGANIZER_EVENTS_MAX_LIMIT,
  fetchOrganizerEvents,
  isEventStatus,
} from "@/lib/organizer";
import { count, ngn, ngnCompact } from "@/lib/metric-format";
import { payoutSetup, type PayoutSetup } from "@/lib/payout-setup";
import { Mascot } from "@/components/Mascot";
import { Panel, StatTile } from "@/components/StatTile";
import { OrganizerEventCard } from "@/components/host/OrganizerEventCard";
import { PayoutSetupCard } from "@/components/host/PayoutSetupCard";
import { Pager } from "@/components/Pager";
import { SoldByEventChart } from "@/components/host/SoldByEventChart";
import { ButtonLink, Container, cx } from "@/components/ui";
import type { EventStatus } from "@/types/api";

export const metadata: Metadata = { title: "Dashboard" };

const PAGE_SIZE = 12;
const CHART_BARS = 7;

const FILTER_LABEL: Record<EventStatus, string> = {
  PUBLISHED: "Live",
  DRAFT: "Drafts",
  COMPLETED: "Ended",
  CANCELLED: "Cancelled",
};

function hrefFor(status: EventStatus | undefined, page = 1) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/host?${qs}` : "/host";
}

/**
 * The organizer's landing page. Ports `v2-mobile/src/screens/DashboardScreen.js`.
 *
 * Two reads of `GET /organizer/events`, in parallel: the largest page the API
 * allows (50) for the chart — "top 7" has to rank across events, not across
 * one page of 12 — and the filtered, paginated page for the cards. The
 * summary in either is computed across ALL the organizer's events.
 */
export default async function HostDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = isEventStatus(sp.status) ? sp.status : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  let overview, list;
  try {
    [overview, list] = await Promise.all([
      fetchOrganizerEvents({ limit: ORGANIZER_EVENTS_MAX_LIMIT }),
      fetchOrganizerEvents({ status, page, limit: PAGE_SIZE }),
    ]);
  } catch (err) {
    // ADMIN passes the (host) gate but the route is @Roles(ORGANIZER).
    if (err instanceof ApiError && err.status === 403) return <OrganizersOnly />;
    throw err;
  }

  const { summary } = overview;
  const greeting = user.firstName ? `Welcome back, ${user.firstName}.` : "Welcome back.";
  // Until card and transfer are open; an ADMIN has no profile and never sees it.
  const setup = user.organizerProfile ? payoutSetup(user) : null;
  const setupCard = setup && !setup.complete ? <PayoutSetupCard setup={setup} /> : null;

  if (summary.totalEvents === 0) return <NoEvents greeting={greeting} setup={setup} />;

  const chartRows = [...overview.events]
    .sort((a, b) => b.stats.ticketsSold - a.stats.ticketsSold)
    .slice(0, CHART_BARS)
    .map((e) => ({
      id: e.id,
      name: e.name,
      sold: e.stats.ticketsSold,
      total: e.stats.totalTickets,
      revenue: e.stats.totalRevenue,
    }));
  const chartScope =
    overview.pagination.total > overview.events.length
      ? `Your top ${chartRows.length} of your ${overview.events.length} most recent events.`
      : `Your top ${chartRows.length} event${chartRows.length === 1 ? "" : "s"}.`;

  return (
    <Container size="page" className="flex flex-col gap-8 py-8 sm:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-text">{greeting}</h1>
        <p className="text-body text-text-dim">
          How your events are selling, across everything you host.
        </p>
      </header>

      {setupCard}

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          tone="accent"
          className="col-span-2 sm:col-span-1"
          label="Ticket revenue"
          value={ngnCompact(summary.totalRevenue)}
          title={ngn(summary.totalRevenue)}
          // It is sold × the CURRENT price, not settled money; say so, since
          // a price change after sales moves this number.
          hint="Tickets sold × current prices"
        />
        <StatTile label="Tickets sold" value={count(summary.totalTicketsSold)} />
        <StatTile
          label="Events"
          value={count(summary.totalEvents)}
          hint={`${count(summary.publishedEvents)} live`}
        />
      </section>

      <Panel title="Tickets sold by event" note={chartScope}>
        <SoldByEventChart rows={chartRows} />
      </Panel>

      <section className="flex flex-col gap-4" aria-labelledby="events-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="events-heading" className="text-section font-bold text-text">
            Your events
          </h2>
          <ButtonLink href="/host/events/new" size="sm" className="w-auto">
            Create event
          </ButtonLink>
        </div>

        {/* The one strip allowed to scroll sideways on a phone. */}
        <nav aria-label="Filter by status" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <ul className="flex w-max gap-2">
            {[undefined, ...EVENT_STATUSES].map((s) => {
              const active = s === status;
              return (
                <li key={s ?? "all"}>
                  <Link
                    href={hrefFor(s)}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex min-h-10 items-center whitespace-nowrap rounded-full border px-4 text-label transition-colors",
                      active
                        ? "border-accent bg-accent-tint text-text"
                        : "border-border bg-surface text-text-dim hover:text-text",
                    )}
                  >
                    {s ? FILTER_LABEL[s] : "All"}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {list.events.length === 0 ? (
          <p className="rounded-card border border-dashed border-border px-5 py-10 text-center text-label text-text-faint">
            {status
              ? `No ${FILTER_LABEL[status].toLowerCase()} events.`
              : "Nothing on this page."}
          </p>
        ) : (
          // grid-cols-1 is minmax(0, 1fr): without it the implicit column
          // grows to fit a long event name and `truncate` never kicks in.
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.events.map((event) => (
              <li key={event.id} className="flex min-w-0">
                <OrganizerEventCard event={event} />
              </li>
            ))}
          </ul>
        )}

        <Pager
          page={page}
          totalPages={list.pagination.totalPages}
          hrefFor={(n) => hrefFor(status, n)}
        />
      </section>
    </Container>
  );
}

function NoEvents({ greeting, setup }: { greeting: string; setup: PayoutSetup | null }) {
  return (
    <Container className="flex flex-col gap-8 py-12">
      <div className="flex flex-col items-center gap-5 text-center">
        <Mascot pose="lets-go" height={130} />
        <h1 className="text-title font-bold text-text">{greeting}</h1>
        <p className="text-body text-text-dim">
          You haven&apos;t created an event yet. It takes a few minutes, saves as
          a draft, and nothing is public until you publish it.
        </p>
        <ButtonLink href="/host/events/new" className="w-full sm:w-auto">
          Create your first event
        </ButtonLink>
      </div>
      {setup && !setup.complete ? <PayoutSetupCard setup={setup} /> : null}

    </Container>
  );
}

function OrganizersOnly() {
  return (
    <Container className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-title font-bold text-text">Organizer accounts only</h1>
      <p className="text-body text-text-dim">
        The host dashboard shows an organizer their own events. Platform-wide
        figures are on the{" "}
        <Link href="/admin" className="font-bold text-accent hover:text-accent-hi">
          admin console
        </Link>
        .
      </p>
    </Container>
  );
}
