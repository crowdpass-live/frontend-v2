import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import {
  TICKET_STATUSES,
  fetchAttendees,
  isTicketStatus,
  settle,
} from "@/lib/organizer";
import { formatDate, formatTime } from "@/lib/format";
import { count } from "@/lib/metric-format";
import { ExportAttendeesButton } from "@/components/host/ExportAttendeesButton";
import { Pager } from "@/components/Pager";
import { Badge, Button, cx } from "@/components/ui";
import type { TicketStatus } from "@/types/api";

export const metadata: Metadata = { title: "Attendees" };

const STATUS: Record<TicketStatus, { label: string; tone: "ok" | "warn" | "info" | "danger" | "neutral" }> = {
  CONFIRMED: { label: "Valid", tone: "ok" },
  USED: { label: "Checked in", tone: "info" },
  PENDING: { label: "Pending", tone: "warn" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};

/**
 * The attendee roster — the SENSITIVE privacy tier.
 *
 * `/attendees` returns buyer email and phone. The door's check-in roster
 * (#47) deliberately does not, and the public ticket page shows a name only.
 * Nothing here may be reused on a door surface.
 *
 * Server-rendered end to end: the search box is a plain GET form and the
 * filters are links, so it works before (or without) JavaScript and every
 * view is a shareable URL.
 */
export default async function HostEventAttendeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ search?: string; status?: string; page?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const status = isTicketStatus(sp.status) ? sp.status : undefined;
  const search = sp.search?.trim().slice(0, 100) || undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const result = await settle(fetchAttendees(id, { status, search, page }));
  // The layout renders the 404 / not-yours state.
  if (!result.ok) return null;
  const { attendees, summary, pagination } = result.value;

  const base = `/host/events/${id}/attendees`;
  const hrefFor = (next: { status?: TicketStatus; page?: number }) => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (next.status) p.set("status", next.status);
    if (next.page && next.page > 1) p.set("page", String(next.page));
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-label">
          <Fact label="Attendees" value={summary.totalAttendees} />
          <Fact label="Valid" value={summary.confirmed} />
          <Fact label="Checked in" value={summary.checkedIn} />
          <Fact label="Cancelled" value={summary.cancelled} />
        </dl>
        <ExportAttendeesButton eventId={id} />
      </div>

      <form action={base} method="get" role="search" className="flex gap-2">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <label className="sr-only" htmlFor="attendee-search">
          Search by name or email
        </label>
        <input
          id="attendee-search"
          name="search"
          type="search"
          defaultValue={search}
          placeholder="Search by name or email"
          maxLength={100}
          className="h-10 min-w-0 flex-1 rounded-control border border-border bg-surface px-4 text-body text-text placeholder:text-text-faint"
        />
        <Button type="submit" variant="secondary" size="sm" className="shrink-0">
          Search
        </Button>
      </form>

      <nav aria-label="Filter by status" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2">
          {[undefined, ...TICKET_STATUSES].map((s) => {
            const active = s === status;
            return (
              <li key={s ?? "all"}>
                <Link
                  href={hrefFor({ status: s })}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "block whitespace-nowrap rounded-full border px-4 py-2 text-label transition-colors",
                    active
                      ? "border-accent bg-accent-tint text-text"
                      : "border-border bg-surface text-text-dim hover:text-text",
                  )}
                >
                  {s ? STATUS[s].label : "All"}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {attendees.length === 0 ? (
        <p className="rounded-card border border-dashed border-border px-5 py-10 text-center text-label text-text-faint">
          {search || status
            ? "No attendees match that."
            : "No one has a ticket yet. Attendees appear here as tickets sell."}
        </p>
      ) : (
        <>
          {/* Phones: one block per attendee. */}
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface sm:hidden">
            {attendees.map((a) => (
              <li key={a.ticketReference} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-body font-bold text-text">
                    {a.buyerName || "No name"}
                  </p>
                  <Badge tone={STATUS[a.status]?.tone ?? "neutral"} className="shrink-0">
                    {STATUS[a.status]?.label ?? a.status}
                  </Badge>
                </div>
                <p className="truncate text-label text-text-dim">
                  {[a.buyerEmail, a.buyerPhone].filter(Boolean).join(" · ") || "No contact details"}
                </p>
                <p className="text-helper text-text-faint">
                  {a.ticketType} · {a.ticketReference}
                </p>
              </li>
            ))}
          </ul>

          {/* Wider screens: a table. */}
          <div className="hidden overflow-x-auto rounded-card border border-border bg-surface sm:block">
            <table className="w-full min-w-[720px] border-collapse text-left text-label">
              <thead className="text-helper text-text-faint">
                <tr>
                  <th scope="col" className="px-4 py-3 font-normal">Name</th>
                  <th scope="col" className="px-4 py-3 font-normal">Contact</th>
                  <th scope="col" className="px-4 py-3 font-normal">Ticket</th>
                  <th scope="col" className="px-4 py-3 font-normal">Status</th>
                  <th scope="col" className="px-4 py-3 font-normal">Bought</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((a) => (
                  <tr key={a.ticketReference} className="border-t border-border align-top">
                    <th scope="row" className="px-4 py-3 font-medium text-text">
                      {a.buyerName || <span className="text-text-faint">No name</span>}
                    </th>
                    <td className="px-4 py-3 text-text-dim">
                      {a.buyerEmail ? <span className="block">{a.buyerEmail}</span> : null}
                      {a.buyerPhone ? <span className="block">{a.buyerPhone}</span> : null}
                      {!a.buyerEmail && !a.buyerPhone ? (
                        <span className="text-text-faint">None</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block text-text">{a.ticketType}</span>
                      <span className="block font-mono text-helper text-text-faint">
                        {a.ticketReference}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS[a.status]?.tone ?? "neutral"}>
                        {STATUS[a.status]?.label ?? a.status}
                      </Badge>
                      {a.checkedInAt ? (
                        <span className="mt-1 block text-helper text-text-faint">
                          {formatTime(a.checkedInAt)}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-text-dim">
                      {formatDate(a.purchasedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pager
        page={page}
        totalPages={pagination.totalPages}
        hrefFor={(n) => hrefFor({ status, page: n })}
        summary={`${count(pagination.total)} results · page ${page} of ${pagination.totalPages}`}
      />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-text-faint">{label}</dt>
      <dd className="font-bold tabular-nums text-text">{count(value)}</dd>
    </div>
  );
}
