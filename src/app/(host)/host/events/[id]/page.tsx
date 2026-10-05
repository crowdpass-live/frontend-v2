import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import {
  fetchEventAnalytics,
  fetchEventControls,
  fetchOnchainBalance,
  fetchOnchainCheckins,
  settle,
} from "@/lib/organizer";
import { count, ngn, ngnCompact, NO_VALUE, titleCase } from "@/lib/metric-format";
import { DailyRevenueChart } from "@/components/DailyRevenueChart";
import { Panel, StatRow, StatTile } from "@/components/StatTile";
import { CancelEvent } from "@/components/host/CancelEvent";
import { TicketTypeTable } from "@/components/host/TicketTypeTable";

export const metadata: Metadata = { title: "Event overview" };

/** Mobile shows 10 days; a laptop has room for a month. */
const CHART_DAYS = 30;

const CHANNEL_LABEL: Record<string, string> = {
  web: "Web",
  whatsapp: "WhatsApp",
  mobile: "Mobile app",
  unknown: "Not recorded",
};

/**
 * The reporting half of `EventAnalyticsScreen.js` — the organizer's control
 * room for one event. Actions (price edit, payouts) are #42.
 *
 * Rule inherited from the admin dashboard: a rate is NOT a number when there
 * was nothing to divide. The API sends `checkInRate` and `averageTicketPrice`
 * as `0` when nothing sold; that is overridden here to an em dash with the
 * reason beside it, because "0% checked in" says the door failed and
 * "nothing sold" says something else entirely.
 */
export default async function HostEventOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  // The layout already resolved (and access-checked) the analytics; this is
  // the same cached promise. The chain reads are slower and may fail alone.
  const [result, balance, checkins, controls] = await Promise.all([
    settle(fetchEventAnalytics(id)),
    settle(fetchOnchainBalance(id)),
    settle(fetchOnchainCheckins(id)),
    settle(fetchEventControls(id)),
  ]);
  // The layout renders the 404 / not-yours state for a failed read.
  if (!result.ok) return null;
  const analytics = result.value;
  const { overview, earnings } = analytics;
  const sold = overview.totalTicketsSold;
  const capacity = sold + overview.totalTicketsAvailable;
  const nothingSold = sold === 0;

  const daily = analytics.dailySales.slice(-CHART_DAYS);
  const ledgerGap = earnings.transactions - earnings.ledgerBackedTransactions;

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Overview" className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatTile
          tone="accent"
          className="col-span-2 xl:col-span-1"
          label="Revenue"
          value={ngnCompact(overview.totalRevenue)}
          title={ngn(overview.totalRevenue)}
          hint="Gross, from completed payments"
        />
        <StatTile
          label="Tickets sold"
          value={count(sold)}
          hint={capacity ? `of ${count(capacity)}` : undefined}
        />
        <StatTile label="Checked in" value={count(overview.totalCheckedIn)} />
        <StatTile
          label="Check-in rate"
          value={nothingSold ? NO_VALUE : `${overview.checkInRate}%`}
          hint={nothingSold ? "Nothing sold yet" : "Of tickets sold"}
        />
        <StatTile
          label="Average price"
          value={nothingSold ? NO_VALUE : ngnCompact(overview.averageTicketPrice)}
          title={nothingSold ? undefined : ngn(overview.averageTicketPrice)}
          hint={nothingSold ? "Nothing sold yet" : undefined}
        />
      </section>

      <Panel
        title="Daily sales"
        note={
          daily.length
            ? analytics.dailySales.length > CHART_DAYS
              ? `Revenue per day, last ${CHART_DAYS} days.`
              : "Revenue per day since the first sale."
            : undefined
        }
      >
        <DailyRevenueChart
          data={daily.map((d) => ({ day: d.date, value: d.revenue, count: d.ticketsSold }))}
          label="Daily ticket revenue"
          countNoun={["ticket", "tickets"]}
          emptyText="No sales yet."
        />
      </Panel>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          title="Ticket types"
          note="Sales come from CrowdPass's records; check-ins and the claimable escrow are read from the chain. The two can differ for a while — a check-in reaches the chain after the door."
        >
          {analytics.ticketTypeBreakdown.length ? (
            <TicketTypeTable
              breakdown={analytics.ticketTypeBreakdown}
              balance={balance.ok ? balance : { ok: false }}
              checkins={checkins.ok ? checkins : { ok: false }}
            />
          ) : (
            <p className="text-label text-text-faint">No ticket types yet.</p>
          )}
        </Panel>

        <Panel title="Where the money went" note="From completed payments.">
          <div className="flex flex-col divide-y divide-border">
            <StatRow label="Gross sales" value={ngn(earnings.gross)} />
            <StatRow label="Platform fee" value={ngn(earnings.platformFee)} />
            <StatRow label="Payment gateway fee" value={ngn(earnings.gatewayFee)} />
            <StatRow
              label="Revenue partners"
              value={ngn(earnings.beneficiaryTotal)}
              sub={
                earnings.beneficiaries.length
                  ? earnings.beneficiaries.map((b) => `${b.name} ${ngn(b.amount)}`).join(" · ")
                  : undefined
              }
            />
            <StatRow label="Net to you" value={ngn(earnings.net)} />
          </div>
          {ledgerGap > 0 ? (
            <p className="text-helper text-text-faint">
              {count(ledgerGap)} of {count(earnings.transactions)} sales predate
              itemised fees, so net may be overstated by their gateway fees.
            </p>
          ) : null}
        </Panel>
      </div>

      {analytics.revenueByProvider.length || analytics.revenueByChannel.length ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Panel title="By payment method">
            <div className="flex flex-col divide-y divide-border">
              {analytics.revenueByProvider.map((p) => (
                <StatRow
                  key={p.provider}
                  label={titleCase(p.provider)}
                  value={ngn(p.amount)}
                  sub={`${count(p.count)} ticket${p.count === 1 ? "" : "s"}`}
                />
              ))}
            </div>
          </Panel>
          <Panel title="By channel">
            <div className="flex flex-col divide-y divide-border">
              {analytics.revenueByChannel.map((c) => (
                <StatRow
                  key={c.channel}
                  label={CHANNEL_LABEL[c.channel] ?? titleCase(c.channel)}
                  value={ngn(c.amount)}
                  sub={`${count(c.count)} ticket${c.count === 1 ? "" : "s"}`}
                />
              ))}
            </div>
          </Panel>
        </div>
      ) : null}
      {controls.ok && controls.value ? (
        <CancelEvent
          eventId={id}
          eventName={analytics.event.name}
          status={controls.value.status}
          ticketsSold={controls.value.ticketsSold}
          isRefundable={controls.value.isRefundable}
        />
      ) : null}
    </div>
  );
}
