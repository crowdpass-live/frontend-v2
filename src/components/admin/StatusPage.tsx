"use client";

import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { fetchAdminOps, fetchHealth } from "@/lib/admin";
import { ago, count, percent, titleCase, NO_VALUE } from "@/lib/admin-format";
import { Panel, StatRow } from "./StatTile";
import { BrandSpinner } from "@/components/BrandSpinner";
import { Badge, Card, Container, ErrorNote, cx } from "@/components/ui";
import type { AdminOps, HealthIndicator, QueueDepth } from "@/types/admin";

/** Pull-only: `/admin/ops` has no push channel, so the page polls. */
const POLL_MS = 60_000;

/**
 * Platform status.
 *
 * **Ops-first, health as a banner** — a deliberate choice forced by the API.
 * `/api/health` is rich when everything is fine (block heights, queue depths)
 * but returns a bare 503 when anything is not: `HttpExceptionFilter` is
 * registered globally and rewrites every error to
 * `{ statusCode, message, timestamp, path }`, discarding Terminus's
 * `info`/`error`/`details`. So health can say "something is down" and never
 * which check — useless precisely during an incident.
 *
 * `/admin/ops` is unaffected by that and carries the real diagnostic weight:
 * failed mints, stuck notifications, webhook errors, stranded KYC. It leads.
 *
 * There is no uptime or latency anywhere on this page, because an API cannot
 * report its own availability — a request that never arrived is a request the
 * server cannot count. That needs Render's metrics or an external prober.
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

  if (ops.isPending) {
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
  const incidents = buildIncidents(o);

  return (
    <Container size="page" className="flex flex-col gap-8 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title font-bold text-text">Status</h1>
          <p className="mt-1 text-helper text-text-faint">
            Last {o.windowHours}h · stuck after {o.stuckAfterMinutes} min ·
            refreshed {ago(o.generatedAt)} · polls every {POLL_MS / 1000}s
          </p>
        </div>
        {incidents.length === 0 ? (
          <Badge tone="ok">Nothing needs attention</Badge>
        ) : (
          <Badge tone="danger">
            {incidents.length} need{incidents.length === 1 ? "s" : ""} attention
          </Badge>
        )}
      </header>

      {/* The alarm list. `paidAwaitingMint` only ever appears here; abandoned
          checkouts never do — they live on the metrics page next to
          conversion, because a healthy funnel always has some and listing them
          as an incident would train everyone to ignore this panel. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-section font-bold text-text">Needs attention</h2>
        {incidents.length === 0 ? (
          <Card className="p-5 text-body text-text-dim">
            No failed mints, stuck notifications, webhook errors or stranded KYC
            in the last {o.windowHours} hours.
          </Card>
        ) : (
          incidents.map((i) => (
            <Card
              key={i.title}
              className={cx(
                "flex items-start gap-4 p-5",
                i.severity === "critical"
                  ? "border-danger/40 bg-danger/5"
                  : "border-warn/40 bg-warn/5",
              )}
            >
              <span
                aria-hidden
                className={cx(
                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-label font-bold",
                  i.severity === "critical"
                    ? "bg-danger/15 text-danger"
                    : "bg-warn/15 text-warn",
                )}
              >
                {i.severity === "critical" ? "!" : "?"}
              </span>
              <div className="min-w-0">
                <p className="text-body font-bold text-text">
                  {i.title}
                  {/* Severity is never colour alone. */}
                  <span
                    className={cx(
                      "ml-2 text-helper font-medium",
                      i.severity === "critical" ? "text-danger" : "text-warn",
                    )}
                  >
                    {i.severity === "critical" ? "Critical" : "Warning"}
                  </span>
                </p>
                <p className="mt-1 text-label text-text-dim">{i.detail}</p>
              </div>
              <span className="ml-auto shrink-0 text-metric font-bold tabular-nums text-text">
                {count(i.value)}
              </span>
            </Card>
          ))
        )}
      </section>

      <HealthBanner query={health} />

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
    </Container>
  );
}

// ---------------------------------------------------------------------------

interface Incident {
  title: string;
  detail: string;
  value: number;
  severity: "critical" | "warning";
}

/**
 * Turns the ops snapshot into a ranked list of things a human should act on.
 *
 * `paidAwaitingMint` leads and is always critical: each one is a buyer who has
 * paid and has nothing. `abandonedCheckouts` is deliberately absent — it is
 * not an incident at any value.
 */
function buildIncidents(o: AdminOps): Incident[] {
  const out: Incident[] = [];

  if (o.payments.paidAwaitingMint > 0) {
    out.push({
      title: "Buyers paid with no ticket",
      detail:
        "Payment settled but the mint has not completed. Check the mint queue and the blockchain worker logs.",
      value: o.payments.paidAwaitingMint,
      severity: "critical",
    });
  }
  if (o.blockchain.failed24h > 0) {
    out.push({
      title: "Mints failed",
      detail: `Exhausted their retries in the last ${o.windowHours} hours.`,
      value: o.blockchain.failed24h,
      severity: "critical",
    });
  }
  if (o.blockchain.stuckPending > 0) {
    out.push({
      title: "Mints stuck",
      detail: `Queued for over ${o.stuckAfterMinutes} minutes without finishing.`,
      value: o.blockchain.stuckPending,
      severity: "warning",
    });
  }
  if (o.notifications.stuckPending > 0) {
    out.push({
      title: "Notifications stuck",
      detail: `Queued for over ${o.stuckAfterMinutes} minutes — buyers are not receiving tickets by email.`,
      value: o.notifications.stuckPending,
      severity: "critical",
    });
  }
  // A share, not a count: one failure out of three is a provider problem, one
  // out of three thousand is a bad address.
  if (o.notifications.failureRate !== null && o.notifications.failureRate > 0.1) {
    out.push({
      title: "Notification failure rate high",
      detail: `${percent(o.notifications.failureRate)} of sends failed in the last ${o.windowHours} hours — check the email provider.`,
      value: o.notifications.failed24h,
      severity: "critical",
    });
  }
  if (o.webhooks.unprocessed > 0) {
    out.push({
      title: "Webhooks unprocessed",
      detail:
        "Received but never handled. Payments may have settled without their tickets being confirmed.",
      value: o.webhooks.unprocessed,
      severity: "critical",
    });
  }
  if (o.webhooks.errored24h > 0) {
    out.push({
      title: "Webhooks errored",
      detail: `Threw while being handled in the last ${o.windowHours} hours.`,
      value: o.webhooks.errored24h,
      severity: "warning",
    });
  }
  if (o.webhooks.invalidSignature24h > 0) {
    out.push({
      title: "Invalid webhook signatures",
      detail:
        "Either a provider key has rotated, or something is posting to the webhook that should not be.",
      value: o.webhooks.invalidSignature24h,
      severity: "warning",
    });
  }
  if (o.kyc.stranded > 0) {
    out.push({
      title: "Organizers stranded in KYC",
      detail: "Started verification and cannot complete it. They cannot be paid out.",
      value: o.kyc.stranded,
      severity: "warning",
    });
  }

  const rank = { critical: 0, warning: 1 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/**
 * `/api/health` reduced to what it can honestly say.
 *
 * When healthy it has real detail worth showing — block heights prove the
 * chain reader is moving, queue depths prove the workers are draining. When it
 * fails, it has none, and this says exactly that rather than implying the page
 * knows more than it does.
 */
function HealthBanner({
  query,
}: {
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof fetchHealth>>>>;
}) {
  if (query.isPending) {
    return (
      <Card className="flex items-center gap-3 p-5">
        <BrandSpinner width={40} label="Checking dependencies" />
        <p className="text-label text-text-dim">Checking dependencies…</p>
      </Card>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Card className="border-warn/40 bg-warn/5 p-5">
        <p className="text-body font-bold text-text">
          Dependency check unreachable
        </p>
        <p className="mt-1 text-label text-text-dim">
          `/api/health` did not respond. That may be the API itself; the panels
          above came from a separate request and are still current.
        </p>
      </Card>
    );
  }

  if (!query.data.ok) {
    return (
      <Card className="border-danger/40 bg-danger/5 p-5">
        <p className="text-body font-bold text-text">
          A dependency check is failing
          <span className="ml-2 text-helper font-medium text-danger">
            Critical
          </span>
        </p>
        <p className="mt-1 text-label text-text-dim">
          {query.data.message} The API returns 503 without saying which check
          failed — its global exception filter drops Terminus&apos;s per-indicator
          detail — so the specifics are in the Render logs. The panels above are
          unaffected and still show where the damage is.
        </p>
      </Card>
    );
  }

  const details = query.data.report.details ?? {};
  const keys = Object.keys(details);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-bold text-text">Dependencies</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {keys.map((key) => (
          <IndicatorCard key={key} name={key} data={details[key]} />
        ))}
      </div>
    </section>
  );
}

function IndicatorCard({
  name,
  data,
}: {
  name: string;
  data: HealthIndicator;
}) {
  const up = data.status === "up";
  return (
    <div
      className={cx(
        "flex flex-col gap-2 rounded-card border p-4",
        up ? "border-border bg-surface" : "border-danger/40 bg-danger/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-bold text-text">
          {titleCase(name)}
        </span>
        {/* Icon + word, never the dot alone. */}
        <span
          className={cx(
            "inline-flex items-center gap-1.5 text-helper font-medium",
            up ? "text-ok" : "text-danger",
          )}
        >
          <span aria-hidden>{up ? "●" : "▲"}</span>
          {up ? "Up" : "Down"}
        </span>
      </div>
      <IndicatorDetail data={data} />
    </div>
  );
}

/**
 * The extras each indicator carries. These are the substance of a status page
 * that cannot report uptime: a block height that advances between polls is
 * live proof the chain reader works, in a way a green dot never is.
 */
function IndicatorDetail({ data }: { data: HealthIndicator }) {
  const rows: { label: string; value: string }[] = [];

  for (const [key, value] of Object.entries(data)) {
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
      // Ids are long and not worth wrapping; the presence is the signal.
      rows.push({
        label: key,
        value: value.length > 14 ? `${value.slice(0, 8)}…` : value,
      });
    }
  }

  if (rows.length === 0) {
    return <p className="text-helper text-text-faint">{NO_VALUE}</p>;
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
