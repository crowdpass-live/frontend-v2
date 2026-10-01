import type { Metadata } from "next";
import { ApiError } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { chainsForEvents, fetchPayouts } from "@/lib/organizer";
import { explorerLinks, shortHash } from "@/lib/onchain";
import { formatDate } from "@/lib/format";
import { count, tokenAmount } from "@/lib/metric-format";
import { ExternalLinkIcon } from "@/components/icons";
import { Pager } from "@/components/Pager";
import { StatTile } from "@/components/StatTile";
import { Badge, Container } from "@/components/ui";
import type { PayoutStatus } from "@/types/api";

export const metadata: Metadata = { title: "Payouts" };

/** Every payout is the on-chain USDC escrow; the summary has no currency. */
const SUMMARY_CURRENCY = "USDC";

const STATUS: Record<PayoutStatus, { label: string; tone: "ok" | "warn" | "info" | "danger" }> = {
  PENDING: { label: "Requested", tone: "warn" },
  PROCESSING: { label: "Processing", tone: "info" },
  COMPLETED: { label: "Paid", tone: "ok" },
  FAILED: { label: "Failed", tone: "danger" },
};

/**
 * Payout history. Ports `PayoutsScreen.js`.
 *
 * Read-only: requesting a payout is #42, on the event page, because it is
 * gated on that event's claimable escrow. Amounts are USDC — the escrow
 * withdrawn to the organizer's CrowdPass wallet — and never naira.
 */
export default async function HostPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireUser();
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);

  let data;
  try {
    data = await fetchPayouts(page);
  } catch (err) {
    // @Roles(ORGANIZER): an ADMIN passes the (host) gate but not this.
    if (err instanceof ApiError && err.status === 403) return <OrganizersOnly />;
    throw err;
  }
  const { payouts, summary, pagination } = data;
  const chains = await chainsForEvents([...new Set(payouts.map((p) => p.eventId))]);

  return (
    <Container size="page" className="flex flex-col gap-6 py-8 sm:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-text">Payouts</h1>
        <p className="max-w-2xl text-body text-text-dim">
          The on-chain USDC escrow from your crypto events, withdrawn to your
          CrowdPass wallet. Card and bank sales settle to your bank directly
          and don&apos;t appear here.
        </p>
      </header>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile tone="accent" className="col-span-2 sm:col-span-1" label="Paid out" value={tokenAmount(summary.totalPaid, SUMMARY_CURRENCY)} />
        <StatTile
          label="In progress"
          value={tokenAmount(summary.pendingAmount, SUMMARY_CURRENCY)}
          hint="Requested or processing"
        />
        <StatTile label="Payouts" value={count(summary.totalPayouts)} />
      </section>

      {payouts.length === 0 ? (
        <p className="rounded-card border border-dashed border-border px-5 py-10 text-center text-label text-text-faint">
          No payouts yet. When an event&apos;s on-chain escrow is ready, you
          request a payout from that event&apos;s page.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
          {payouts.map((p) => {
            const status = STATUS[p.status] ?? { label: p.status, tone: "info" as const };
            const link = explorerLinks(chains.get(p.eventId), { tx: p.providerReference }).tx;
            return (
              <li
                key={p.id}
                className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-bold text-text">{p.eventName}</p>
                  <p className="text-helper text-text-faint">
                    {formatDate(p.processedAt ?? p.createdAt)}
                    {p.providerReference ? (
                      <>
                        {" · "}
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="-my-3 inline-flex items-center gap-1 py-3 font-mono text-text-dim underline-offset-2 hover:text-text hover:underline"
                          >
                            {shortHash(p.providerReference)}
                            <ExternalLinkIcon width={12} height={12} />
                            <span className="sr-only">(opens the block explorer)</span>
                          </a>
                        ) : (
                          <span className="font-mono" title={p.providerReference}>
                            {shortHash(p.providerReference)}
                          </span>
                        )}
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <p className="text-body font-bold tabular-nums text-text">
                    {tokenAmount(p.amount, p.currency)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pager
        page={page}
        totalPages={pagination.totalPages}
        hrefFor={(n) => (n > 1 ? `/host/payouts?page=${n}` : "/host/payouts")}
      />
    </Container>
  );
}

function OrganizersOnly() {
  return (
    <Container className="py-20 text-center">
      <h1 className="text-title font-bold text-text">Organizer accounts only</h1>
      <p className="mt-3 text-body text-text-dim">
        Payouts belong to an organizer&apos;s own events.
      </p>
    </Container>
  );
}
