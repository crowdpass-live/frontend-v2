"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminDaily, fetchAdminMetrics, fetchAdminOps } from "@/lib/admin";
import {
  ago,
  count,
  lastDays,
  ngn,
  ngnCompact,
  percent,
  stamp,
  titleCase,
  NO_VALUE,
} from "@/lib/admin-format";
import { RevenueChart } from "./RevenueChart";
import { Panel, StatRow, StatTile } from "./StatTile";
import { BrandSpinner } from "@/components/BrandSpinner";
import { Button, Card, Container, ErrorNote, cx } from "@/components/ui";
import { ApiError } from "@/lib/api";

const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
] as const;

export function MetricsDashboard() {
  // The range is derived from the preset at query time, never held in state,
  // so "30 days" means the last 30 days from now rather than from whenever the
  // tab was opened — a dashboard left open overnight would otherwise quietly
  // keep reporting yesterday.
  const [days, setDays] = useState<number>(30);

  const metrics = useQuery({
    queryKey: ["admin", "metrics", days],
    queryFn: () => fetchAdminMetrics(lastDays(days)),
  });
  const daily = useQuery({
    queryKey: ["admin", "daily", days],
    queryFn: () => fetchAdminDaily(lastDays(days)),
  });
  // Only for the abandoned-checkout figure, which belongs beside conversion
  // here rather than in the incident list on the status page.
  const ops = useQuery({
    queryKey: ["admin", "ops"],
    queryFn: fetchAdminOps,
    staleTime: 60_000,
  });

  if (metrics.isPending) {
    return (
      <Container size="page" className="grid place-items-center py-24">
        <BrandSpinner width={92} label="Loading metrics" />
      </Container>
    );
  }

  if (metrics.isError) {
    const err = metrics.error;
    const forbidden = err instanceof ApiError && err.status === 403;
    return (
      <Container size="page" className="pt-10">
        <Card className="flex flex-col items-start gap-4 p-6">
          <ErrorNote>
            {forbidden
              ? "This account is not an ADMIN, so the platform metrics are refused by the API."
              : err instanceof Error
                ? err.message
                : "Could not load metrics."}
          </ErrorNote>
          <Button
            type="button"
            variant="secondary"
            className="w-auto min-w-[160px]"
            onClick={() => metrics.refetch()}
          >
            Try again
          </Button>
        </Card>
      </Container>
    );
  }

  const m = metrics.data;
  const noSales = m.revenue.transactions === 0;

  return (
    <Container size="page" className="flex flex-col gap-8 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title font-bold text-text">Platform metrics</h1>
          <p className="mt-1 text-helper text-text-faint">
            {stamp(m.range.from)} → {stamp(m.range.to)} · generated{" "}
            {ago(m.generatedAt)}
          </p>
        </div>

        <div className="flex gap-2" role="group" aria-label="Date range">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              aria-pressed={days === p.days}
              onClick={() => setDays(p.days)}
              className={cx(
                "h-10 rounded-full px-4 text-label font-medium transition-colors",
                days === p.days
                  ? "bg-accent text-ink"
                  : "bg-surface text-text-dim hover:bg-surface-strong hover:text-text",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Headline money */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="GMV"
          value={ngnCompact(m.revenue.gmv)}
          title={ngn(m.revenue.gmv)}
          hint="Everything buyers paid"
          tone="accent"
        />
        <StatTile
          label="Platform fee"
          value={ngnCompact(m.revenue.platformFee)}
          title={ngn(m.revenue.platformFee)}
          hint="What CrowdPass keeps"
        />
        <StatTile
          label="Take rate"
          value={percent(m.revenue.takeRate)}
          hint={
            m.revenue.takeRate === null
              ? "No sales in this range"
              : "Platform fee ÷ GMV"
          }
        />
        <StatTile
          label="Avg order value"
          value={
            m.revenue.averageOrderValue === null
              ? NO_VALUE
              : ngn(m.revenue.averageOrderValue)
          }
          hint={
            m.revenue.averageOrderValue === null
              ? "No settled transactions"
              : `${count(m.revenue.transactions)} transactions`
          }
        />
      </section>

      <Panel
        title="Daily revenue"
        note={
          noSales
            ? "Nothing settled in this range."
            : `${count(m.revenue.transactions)} settled transactions · hover for a day's detail`
        }
      >
        {daily.isPending ? (
          <div className="grid h-[240px] place-items-center">
            <BrandSpinner width={72} label="Loading chart" />
          </div>
        ) : daily.isError ? (
          <ErrorNote>Could not load the daily series.</ErrorNote>
        ) : (
          <RevenueChart data={daily.data} />
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Where the money went"
          note="Gross split across the range"
        >
          <div className="divide-y divide-border">
            <StatRow label="Gross (GMV)" value={ngn(m.revenue.gmv)} />
            <StatRow label="Platform fee" value={ngn(m.revenue.platformFee)} />
            <StatRow label="Gateway fee" value={ngn(m.revenue.gatewayFee)} />
            <StatRow
              label="Organizer amount"
              value={ngn(m.revenue.organizerAmount)}
            />
          </div>
        </Panel>

        <Panel
          title="By provider"
          note="Settled transactions only"
        >
          {m.revenue.byProvider.length === 0 ? (
            <p className="py-2 text-label text-text-faint">
              No settled transactions in this range.
            </p>
          ) : (
            <ProviderBars data={m.revenue.byProvider} />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Tickets">
          <div className="divide-y divide-border">
            <StatRow label="Sold" value={count(m.tickets.sold)} />
            <StatRow label="Checked in" value={count(m.tickets.checkedIn)} />
            <StatRow
              label="Attendance"
              value={percent(m.tickets.attendanceRate)}
              sub={
                m.tickets.attendanceRate === null
                  ? "No tickets sold in this range"
                  : undefined
              }
            />
          </div>
        </Panel>

        <Panel title="Events" note={`${count(m.events.created)} created`}>
          <div className="divide-y divide-border">
            {Object.keys(m.events.byStatus).length === 0 ? (
              <p className="py-2 text-label text-text-faint">
                No events created in this range.
              </p>
            ) : (
              // A partial record: a status with no rows is absent, not zero.
              Object.entries(m.events.byStatus).map(([status, n]) => (
                <StatRow
                  key={status}
                  label={titleCase(status)}
                  value={count(n ?? 0)}
                />
              ))
            )}
          </div>
        </Panel>

        <Panel title="Users">
          <div className="divide-y divide-border">
            <StatRow label="New users" value={count(m.users.new)} />
            <StatRow
              label="New organizers"
              value={count(m.users.newOrganizers)}
            />
            <StatRow
              label="Abandoned checkouts"
              value={
                ops.data ? count(ops.data.payments.abandonedCheckouts) : NO_VALUE
              }
              sub="Started, never paid — normal for any funnel"
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Organizer KYC"
          /* Deliberately not range-scoped, and labelled so nobody reads it as
             belonging to the selected period. */
          note="Current standings across the platform — not this date range"
        >
          <div className="divide-y divide-border">
            <StatRow label="Verified" value={count(m.kyc.verified)} />
            <StatRow label="Pending" value={count(m.kyc.pending)} />
          </div>
        </Panel>

        <Panel title="Payouts" note="Completed in this range">
          <div className="divide-y divide-border">
            <StatRow label="Completed" value={count(m.payouts.completed)} />
            <StatRow label="Amount" value={ngn(m.payouts.amount)} />
          </div>
        </Panel>
      </div>
    </Container>
  );
}

/**
 * Provider split as a bar list.
 *
 * One colour for every bar. These are nominal categories carrying one measure,
 * so a per-provider hue would burn the only free channel restating bar length,
 * and a value-ramp would double-encode it.
 */
function ProviderBars({
  data,
}: {
  data: { provider: string; amount: number; transactions: number }[];
}) {
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <ul className="flex flex-col gap-3">
      {data.map((p) => (
        <li key={p.provider} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-label text-text">{titleCase(p.provider)}</span>
            <span className="text-label font-bold tabular-nums text-text">
              {ngn(p.amount)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-strong">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.max(2, (p.amount / max) * 100)}%` }}
            />
          </div>
          <span className="text-helper text-text-faint">
            {count(p.transactions)} transaction
            {p.transactions === 1 ? "" : "s"}
          </span>
        </li>
      ))}
    </ul>
  );
}
