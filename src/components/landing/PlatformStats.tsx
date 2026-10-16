import type { ReactNode } from "react";
import { fetchPublicStats } from "@/lib/crowdpass";
import { Skeleton } from "../Skeleton";
import { Container } from "../ui";
import type { ApiPublicStats } from "@/types/api";

/**
 * "By the numbers", read live from `GET /stats/public`.
 *
 * Real counts or nothing. If the endpoint fails (or isn't deployed yet) the
 * strip disappears rather than showing zeros or a placeholder figure: a
 * landing page quoting numbers it can't back up is worse than one quoting
 * none.
 */
const STATS: { key: keyof Omit<ApiPublicStats, "generatedAt">; label: string }[] = [
  { key: "eventsHosted", label: "Events hosted" },
  { key: "ticketsSold", label: "Tickets sold" },
  { key: "checkIns", label: "Check-ins at the door" },
  { key: "hosts", label: "Hosts onboarded" },
];

const exact = new Intl.NumberFormat("en-NG");
const compact = new Intl.NumberFormat("en-NG", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Exact up to five digits, then compact (`12.4K`), so the tiles never wrap. */
const format = (n: number) => (n < 100_000 ? exact.format(n) : compact.format(n));

export async function PlatformStats() {
  const stats = await fetchPublicStats().catch(() => null);
  if (!stats) return null;

  return (
    <Band>
      <p className="flex items-center gap-2 text-helper text-text-faint">
        <span className="relative inline-flex size-2" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-ok/60" />
          <span className="relative size-2 rounded-full bg-ok" />
        </span>
        Live from the platform
      </p>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border lg:grid-cols-4">
        {STATS.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-1 bg-bg p-5 sm:p-6 lg:p-8">
            <dt className="order-2 text-label text-text-dim">{label}</dt>
            <dd className="order-1 text-3xl font-bold tabular-nums tracking-tight text-text sm:text-4xl lg:text-5xl">
              {format(stats[key])}
            </dd>
          </div>
        ))}
      </dl>
    </Band>
  );
}

export function PlatformStatsSkeleton() {
  return (
    <Band busy>
      <Skeleton className="h-4 w-36" />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border lg:grid-cols-4">
        {STATS.map(({ key }) => (
          <div key={key} className="flex flex-col gap-2 bg-bg p-5 sm:p-6 lg:p-8">
            <Skeleton className="h-9 w-20 lg:h-12" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </Band>
  );
}

/**
 * The section owns its own padding, so when the stats are unavailable the
 * whole band goes, not just its contents — no empty gap under the hero.
 */
function Band({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <section aria-label="CrowdPass by the numbers" aria-busy={busy} className="pb-16 lg:pb-24">
      <Container size="page" className="flex flex-col gap-4">
        {children}
      </Container>
    </section>
  );
}
