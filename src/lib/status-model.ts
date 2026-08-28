import type { AdminOps, HealthReport } from "@/types/admin";
import type { HealthResult } from "./admin";

/**
 * Turns the two raw snapshots into the component model a status page shows.
 *
 * The vocabulary is statuspage.io's, because it is the one people already read
 * correctly — "Operational", "Degraded Performance", "Partial Outage", "Major
 * Outage". One label is added that statuspage does not have and CrowdPass
 * needs: **Unknown**. When `/api/health` returns 503 the global exception
 * filter has already discarded which indicator failed, so claiming a
 * dependency is either up or down would be an invention. Unknown says what is
 * actually true.
 *
 * Every status below is derived from a signal the API really reports. Nothing
 * here is a placeholder, and nothing is green by default — a component with no
 * signal is Unknown, not Operational.
 */

export type Level =
  | "operational"
  | "degraded"
  | "partial"
  | "major"
  | "unknown";

export const LEVEL_LABEL: Record<Level, string> = {
  operational: "Operational",
  degraded: "Degraded Performance",
  partial: "Partial Outage",
  major: "Major Outage",
  unknown: "Status Unknown",
};

/** Worst-first, for rolling components up into the overall banner. */
const SEVERITY: Record<Level, number> = {
  major: 4,
  partial: 3,
  degraded: 2,
  unknown: 1,
  operational: 0,
};

export interface Component {
  /** Stable key, so a component keeps its identity across polls. */
  key: string;
  name: string;
  /** What this component means in product terms, not in system terms. */
  description: string;
  level: Level;
  /** Why it is at this level. Always populated — even when operational. */
  reason: string;
  group: "Buying a ticket" | "Platform services";
}

function worst(levels: Level[]): Level {
  return levels.reduce<Level>(
    (acc, l) => (SEVERITY[l] > SEVERITY[acc] ? l : acc),
    "operational",
  );
}

/** Health indicator status, or `unknown` when the 503 hid the detail. */
function indicator(health: HealthResult, key: string): Level {
  if (!health.ok) return "unknown";
  const report: HealthReport = health.report;
  const found = report.details?.[key];
  if (!found) return "unknown";
  return found.status === "up" ? "operational" : "major";
}

function indicatorReason(health: HealthResult, key: string, up: string) {
  if (!health.ok) {
    return "A health check is failing, but the API does not report which one.";
  }
  const found = health.ok ? health.report.details?.[key] : undefined;
  if (!found) return "Not reported by the health check.";
  return found.status === "up" ? up : "The health check reports this as down.";
}

export function buildComponents(
  ops: AdminOps,
  health: HealthResult,
): Component[] {
  const hours = ops.windowHours;
  const mins = ops.stuckAfterMinutes;

  // --- Buying a ticket: the buyer-visible path, in the order it happens ----

  // Checkout depends on the database being reachable; a payment that cannot
  // be recorded cannot be honoured.
  const checkoutLevel = indicator(health, "database");

  const webhookLevel: Level =
    ops.webhooks.unprocessed > 0
      ? "partial"
      : ops.webhooks.errored24h > 0 || ops.webhooks.invalidSignature24h > 0
        ? "degraded"
        : "operational";

  // The one that means someone is out of pocket.
  const mintLevel: Level =
    ops.payments.paidAwaitingMint > 0
      ? "major"
      : ops.blockchain.failed24h > 0
        ? "partial"
        : ops.blockchain.stuckPending > 0
          ? "degraded"
          : "operational";

  const deliveryLevel: Level =
    ops.notifications.failureRate !== null && ops.notifications.failureRate > 0.1
      ? "major"
      : ops.notifications.stuckPending > 0
        ? "partial"
        : ops.notifications.failed24h > 0
          ? "degraded"
          : "operational";

  return [
    {
      key: "checkout",
      name: "Checkout",
      description: "Browsing events and starting a payment",
      group: "Buying a ticket",
      level: checkoutLevel,
      reason: indicatorReason(
        health,
        "database",
        "The database is reachable, so orders can be recorded.",
      ),
    },
    {
      key: "payment-confirmation",
      name: "Payment confirmation",
      description: "Gateway callbacks that turn a payment into a ticket",
      group: "Buying a ticket",
      level: webhookLevel,
      reason:
        ops.webhooks.unprocessed > 0
          ? `${ops.webhooks.unprocessed} webhook(s) received but never handled — payments may have settled without their tickets being confirmed.`
          : ops.webhooks.errored24h > 0 || ops.webhooks.invalidSignature24h > 0
            ? `${ops.webhooks.errored24h} errored and ${ops.webhooks.invalidSignature24h} failed signature checks in the last ${hours}h.`
            : `No webhook errors in the last ${hours}h.`,
    },
    {
      key: "ticket-issuing",
      name: "Ticket issuing",
      description: "Minting the ticket on-chain after payment",
      group: "Buying a ticket",
      level: mintLevel,
      reason:
        ops.payments.paidAwaitingMint > 0
          ? `${ops.payments.paidAwaitingMint} buyer(s) have paid and have no ticket.`
          : ops.blockchain.failed24h > 0
            ? `${ops.blockchain.failed24h} mint(s) exhausted their retries in the last ${hours}h.`
            : ops.blockchain.stuckPending > 0
              ? `${ops.blockchain.stuckPending} mint(s) queued over ${mins} min.`
              : `No failed or stuck mints in the last ${hours}h.`,
    },
    {
      key: "ticket-delivery",
      name: "Ticket delivery",
      description: "Emailing the ticket and its QR to the buyer",
      group: "Buying a ticket",
      level: deliveryLevel,
      reason:
        deliveryLevel === "major"
          ? `${Math.round((ops.notifications.failureRate ?? 0) * 100)}% of sends failed in the last ${hours}h.`
          : ops.notifications.stuckPending > 0
            ? `${ops.notifications.stuckPending} notification(s) queued over ${mins} min.`
            : ops.notifications.failed24h > 0
              ? `${ops.notifications.failed24h} send(s) failed in the last ${hours}h.`
              : ops.notifications.sent24h === 0
                ? `Nothing sent in the last ${hours}h — no failures, but nothing to measure either.`
                : `${ops.notifications.sent24h} sent in the last ${hours}h with no failures.`,
    },

    // --- Platform services: the dependencies underneath --------------------
    {
      key: "database",
      name: "Database",
      description: "PostgreSQL",
      group: "Platform services",
      level: indicator(health, "database"),
      reason: indicatorReason(health, "database", "Responding to queries."),
    },
    {
      key: "wallets",
      name: "Wallets",
      description: "Circle wallet-as-a-service",
      group: "Platform services",
      level: indicator(health, "circle"),
      reason: indicatorReason(health, "circle", "The wallet set is reachable."),
    },
    {
      key: "blockchain",
      name: "Chain reader",
      description: "RPC access to Base and Arc",
      group: "Platform services",
      level: indicator(health, "blockchain"),
      reason: indicatorReason(
        health,
        "blockchain",
        "Every configured chain is returning block heights.",
      ),
    },
    {
      key: "queues",
      name: "Background workers",
      description: "Redis-backed mint and notification queues",
      group: "Platform services",
      level: indicator(health, "queues"),
      reason: indicatorReason(
        health,
        "queues",
        "Redis is reachable and no queue is backed up.",
      ),
    },
    {
      key: "kyc",
      name: "Organizer verification",
      description: "KYC, which gates organizer payouts",
      group: "Platform services",
      level:
        ops.kyc.stranded > 0 || ops.kyc.failed24h > 0 ? "degraded" : "operational",
      reason:
        ops.kyc.stranded > 0
          ? `${ops.kyc.stranded} organizer(s) stranded mid-verification and cannot be paid out.`
          : ops.kyc.failed24h > 0
            ? `${ops.kyc.failed24h} verification(s) failed in the last ${hours}h.`
            : "No stranded or failed verifications.",
    },
  ];
}

/** The banner headline, rolled up from the components. */
export function overallLevel(components: Component[]): Level {
  return worst(components.map((c) => c.level));
}

export function overallHeadline(level: Level, components: Component[]): string {
  if (level === "operational") return "All Systems Operational";
  if (level === "unknown") return "Some Systems Unreported";
  const affected = components.filter((c) => c.level !== "operational").length;
  const noun = affected === 1 ? "System" : "Systems";
  if (level === "major") return `Major Outage — ${affected} ${noun} Affected`;
  if (level === "partial") return `Partial Outage — ${affected} ${noun} Affected`;
  return `Degraded Performance — ${affected} ${noun} Affected`;
}
