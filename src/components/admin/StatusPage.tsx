"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { fetchAdminOps, fetchHealth } from "@/lib/admin";
import { ago, count, percent, titleCase } from "@/lib/admin-format";
import {
  buildComponents,
  overallHeadline,
  overallLevel,
  LEVEL_LABEL,
  type Component,
  type Level,
} from "@/lib/status-model";
import { Panel, StatRow } from "./StatTile";
import { BrandSpinner } from "@/components/BrandSpinner";
import { Card, Container, ErrorNote, cx } from "@/components/ui";
import type { HealthIndicator, QueueDepth } from "@/types/admin";

/** Pull-only: `/admin/ops` has no push channel, so the page polls. */
const POLL_MS = 60_000;

/**
 * Platform status, in the shape of a public status page.
 *
 * Two things it deliberately does NOT have, both because the data does not
 * exist rather than because they were skipped:
 *
 * **No uptime percentages, and no 90-day history bars.** That row of green
 * day-blocks is the defining element of statuspage.io, and it comes from an
 * *external prober* recording a sample every minute. CrowdPass has no such
 * store and no prober — the API cannot report its own availability, because a
 * request that never arrived is one the server cannot count. Drawing the strip
 * from what this browser happened to observe would produce a number that looks
 * authoritative and means "whenever someone had the tab open". Better to have
 * no strip than a dishonest one; see the note rendered at the foot of the page.
 *
 * **No incident history.** Nothing persists past incidents, so there is
 * nothing truthful to list.
 *
 * What it does have is a component model derived entirely from real signals,
 * where nothing is green by default — a component with no signal reads
 * Unknown.
 */
export function StatusPage() {
  const ops = useQuery({
    queryKey: ["admin", "ops"],
    queryFn: fetchAdminOps,
    refetchInterval: POLL_MS,
  });
  const health = useQuery({
    queryKey: ["admin", "health"],
    queryFn: fetchHealth,
    refetchInterval: POLL_MS,
  });

  const components = useMemo(
    () =>
      ops.data && health.data ? buildComponents(ops.data, health.data) : null,
    [ops.data, health.data],
  );

  if (ops.isPending || health.isPending) {
    return (
      <Container size="page" className="grid place-items-center py-24">
        <BrandSpinner width={92} label="Loading status" />
      </Container>
    );
  }

  if (ops.isError) {
    const forbidden = ops.error instanceof ApiError && ops.error.status === 403;
    return (
      <Container size="page" className="pt-10">
        <Card className="p-6">
          <ErrorNote>
            {forbidden
              ? "This account is not an ADMIN, so the operational snapshot is refused by the API."
              : "Could not load the operational snapshot."}
          </ErrorNote>
        </Card>
      </Container>
    );
  }

  const o = ops.data;
  const level = components ? overallLevel(components) : "unknown";
  const headline = components
    ? overallHeadline(level, components)
    : "Status Unknown";
  const groups = ["Buying a ticket", "Platform services"] as const;

  return (
    <Container size="page" className="flex flex-col gap-8 pt-8">
      {/* Banner. The one thing a status page has to answer in one glance. */}
      <section
        className={cx(
          "flex flex-wrap items-center justify-between gap-4 rounded-card border p-6",
          BANNER[level],
        )}
      >
        <div className="flex items-center gap-4">
          <StatusGlyph level={level} size={40} />
          <div>
            <h1 className="text-title font-bold text-text">{headline}</h1>
            <p className="mt-0.5 text-helper text-text-dim">
              Refreshed {ago(o.generatedAt)} · polls every {POLL_MS / 1000}s
            </p>
          </div>
        </div>
        {health.data && !health.data.ok ? (
          <p className="max-w-sm text-helper text-text-dim">
            A dependency check is failing and the API does not report which —
            the platform services below read Unknown rather than guessing.
          </p>
        ) : null}
      </section>

      {/* Components, grouped by what a reader is actually asking about. */}
      {components
        ? groups.map((group) => {
            const rows = components.filter((c) => c.group === group);
            if (rows.length === 0) return null;
            return (
              <section key={group} className="flex flex-col gap-3">
                <h2 className="text-section font-bold text-text">{group}</h2>
                <div className="overflow-hidden rounded-card border border-border">
                  {rows.map((c, i) => (
                    <ComponentRow key={c.key} c={c} first={i === 0} />
                  ))}
                </div>
              </section>
            );
          })
        : null}

      {/* The detail behind the statuses. Kept because during an incident the
          raw counts are what you actually work from. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Notifications"
          note={`Last ${o.windowHours}h · email and messaging delivery`}
        >
          <div className="divide-y divide-border">
            <StatRow label="Sent" value={count(o.notifications.sent24h)} />
            <StatRow label="Failed" value={count(o.notifications.failed24h)} />
            <StatRow
              label="Failure rate"
              value={percent(o.notifications.failureRate)}
              sub={
                o.notifications.failureRate === null
                  ? "Nothing was sent in this window"
                  : undefined
              }
            />
            <StatRow
              label="Stuck pending"
              value={count(o.notifications.stuckPending)}
              sub={`Queued over ${o.stuckAfterMinutes} min`}
            />
          </div>
        </Panel>

        <Panel title="Minting" note={`Last ${o.windowHours}h · on-chain tickets`}>
          <div className="divide-y divide-border">
            <StatRow label="Failed" value={count(o.blockchain.failed24h)} />
            <StatRow
              label="Stuck pending"
              value={count(o.blockchain.stuckPending)}
              sub={`Queued over ${o.stuckAfterMinutes} min`}
            />
            <StatRow
              label="Paid, awaiting mint"
              value={count(o.payments.paidAwaitingMint)}
              sub="Buyers out of pocket with no ticket"
            />
          </div>
        </Panel>

        <Panel title="Webhooks" note={`Last ${o.windowHours}h · inbound`}>
          <div className="divide-y divide-border">
            <StatRow
              label="Invalid signature"
              value={count(o.webhooks.invalidSignature24h)}
            />
            <StatRow label="Errored" value={count(o.webhooks.errored24h)} />
            <StatRow label="Unprocessed" value={count(o.webhooks.unprocessed)} />
          </div>
        </Panel>

        <Panel title="KYC" note="Organizer verification">
          <div className="divide-y divide-border">
            <StatRow label="Stranded" value={count(o.kyc.stranded)} />
            <StatRow
              label={`Failed (${o.windowHours}h)`}
              value={count(o.kyc.failed24h)}
            />
          </div>
        </Panel>
      </div>

      {health.data?.ok ? <Dependencies report={health.data.report.details} /> : null}

      {/* Stated plainly rather than quietly omitted, so nobody assumes the
          numbers exist somewhere and just aren't shown. */}
      <Card className="p-5">
        <p className="text-label font-bold text-text">
          Why there is no uptime percentage
        </p>
        <p className="mt-1.5 text-helper text-text-dim">
          A 90-day uptime bar comes from an external prober sampling the API
          from outside. CrowdPass has none, and an API cannot measure its own
          availability — a request that never arrived is one the server cannot
          count. Everything above is a live reading, not a history. Real uptime
          needs either Render&apos;s own metrics or an external monitor; a
          persisted sample table would also give this page a genuine incident
          timeline.
        </p>
      </Card>
    </Container>
  );
}

// ---------------------------------------------------------------------------

const BANNER: Record<Level, string> = {
  operational: "border-ok/40 bg-ok/5",
  degraded: "border-warn/40 bg-warn/5",
  partial: "border-warn/40 bg-warn/5",
  major: "border-danger/40 bg-danger/5",
  unknown: "border-border bg-surface",
};

const DOT: Record<Level, string> = {
  operational: "bg-ok/15 text-ok",
  degraded: "bg-warn/15 text-warn",
  partial: "bg-warn/15 text-warn",
  major: "bg-danger/15 text-danger",
  unknown: "bg-surface-strong text-text-faint",
};

const TEXT: Record<Level, string> = {
  operational: "text-ok",
  degraded: "text-warn",
  partial: "text-warn",
  major: "text-danger",
  unknown: "text-text-faint",
};

/**
 * Status is never colour alone: each level has its own shape as well as its
 * own hue, and the label is always written out beside it.
 */
function StatusGlyph({ level, size = 24 }: { level: Level; size?: number }) {
  const glyph =
    level === "operational"
      ? "✓"
      : level === "major"
        ? "!"
        : level === "unknown"
          ? "?"
          : "▲";
  return (
    <span
      aria-hidden
      className={cx("grid shrink-0 place-items-center rounded-full", DOT[level])}
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {glyph}
    </span>
  );
}

function ComponentRow({ c, first }: { c: Component; first: boolean }) {
  return (
    <div
      className={cx(
        "flex items-start gap-4 bg-surface p-4",
        !first && "border-t border-border",
      )}
    >
      <StatusGlyph level={c.level} />
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-text">{c.name}</p>
        <p className="text-helper text-text-faint">{c.description}</p>
        {/* The reason shows for every level, not only bad ones — "why do you
            believe this is fine" is as useful as "what broke". */}
        <p className="mt-1.5 text-helper text-text-dim">{c.reason}</p>
      </div>
      <span
        className={cx(
          "shrink-0 text-label font-medium sm:text-right",
          TEXT[c.level],
        )}
      >
        {LEVEL_LABEL[c.level]}
      </span>
    </div>
  );
}

/** The extras the healthy report carries — live proof, not a green dot. */
function Dependencies({
  report,
}: {
  report: Record<string, HealthIndicator>;
}) {
  const keys = Object.keys(report ?? {});
  if (keys.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-bold text-text">Live readings</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {keys.map((key) => (
          <div
            key={key}
            className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
          >
            <span className="text-label font-bold text-text">
              {titleCase(key)}
            </span>
            <IndicatorDetail data={report[key]} />
          </div>
        ))}
      </div>
    </section>
  );
}

function IndicatorDetail({ data }: { data: HealthIndicator }) {
  const rows: { label: string; value: string }[] = [];

  for (const [key, value] of Object.entries(data ?? {})) {
    if (key === "status") continue;

    // `queues` nests one object per Bull queue.
    if (value && typeof value === "object" && "waiting" in value) {
      const q = value as unknown as QueueDepth;
      rows.push({
        label: q.name ?? key,
        value: `${q.waiting} waiting · ${q.active} active · ${q.failed} failed`,
      });
      continue;
    }
    if (typeof value === "number") {
      rows.push({ label: key, value: `block ${count(value)}` });
      continue;
    }
    if (typeof value === "string") {
      rows.push({
        label: key,
        value: value.length > 14 ? `${value.slice(0, 8)}…` : value,
      });
    }
  }

  if (rows.length === 0) {
    // A bare dash reads as missing data. This indicator simply reports
    // liveness and nothing else, which is worth saying.
    return (
      <p className="text-helper text-text-faint">
        Reachable — no further readings
      </p>
    );
  }

  return (
    <dl className="flex flex-col gap-1">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-2">
          <dt className="truncate text-helper text-text-faint">{r.label}</dt>
          <dd className="shrink-0 text-helper tabular-nums text-text-dim">
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
