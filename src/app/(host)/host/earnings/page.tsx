import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { fetchBeneficiaryEarnings } from "@/lib/organizer";
import { count, ngn, ngnCompact } from "@/lib/metric-format";
import { StatTile } from "@/components/StatTile";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Earnings" };

/**
 * What this organizer earned as a revenue partner on OTHER organizers'
 * events. Ports `BeneficiaryEarningsScreen.js`.
 *
 * Deliberately narrow, as on mobile: the viewer's own share per event and
 * nothing else — no gross, no co-partners. It is someone else's event; their
 * totals are not the viewer's business. Settled sales only. Rows link to the
 * public event page, the only view of it this account is entitled to.
 */
export default async function HostEarningsPage() {
  await requireUser();
  const { totalEarned, events } = await fetchBeneficiaryEarnings();

  return (
    <Container size="page" className="flex flex-col gap-6 py-8 sm:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-text">Partner earnings</h1>
        <p className="max-w-2xl text-body text-text-dim">
          Your share of ticket sales on events where another organizer added
          you as a revenue partner. Only completed sales count.
        </p>
      </header>

      <section aria-label="Summary" className="grid gap-3 sm:grid-cols-3">
        <StatTile tone="accent" label="Earned" value={ngnCompact(totalEarned)} title={ngn(totalEarned)} />
        <StatTile label="Events" value={count(events.length)} />
      </section>

      {events.length === 0 ? (
        <p className="rounded-card border border-dashed border-border px-5 py-10 text-center text-label text-text-faint">
          Nothing yet. When an organizer shares an event&apos;s revenue with you,
          your cut of each sale shows up here.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
          {events.map((e) => (
            <li key={e.eventId}>
              <Link
                href={`/events/${e.slug}`}
                className="flex items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-surface-strong sm:px-5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-body font-bold text-text">{e.name}</span>
                  <span className="block text-helper text-text-faint">
                    {count(e.sales)} sale{e.sales === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="shrink-0 text-body font-bold tabular-nums text-text">
                  {ngn(e.amount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
