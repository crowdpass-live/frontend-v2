import type { PaymentProvider } from "./api";

/**
 * Wire types for the admin surface, mirrored from `Backend-v2` PR #21
 * (`src/admin/admin-metrics.service.ts`, `admin-ops.service.ts`) and the
 * Terminus health controller.
 *
 * Every route under `/admin` is `@Roles(UserRole.ADMIN)` — a class-level
 * decorator with no per-route override. That is a *different* gate from the
 * organizer pages, which use `@Roles(ORGANIZER, ADMIN)`: an ORGANIZER token
 * gets 403 here, because these expose revenue across every organizer.
 */

/**
 * Rates are `null`, never `0`, when there is nothing to divide.
 *
 * The distinction carries meaning the UI must preserve: `0` says "we measured
 * and the answer is zero", `null` says "there was nothing to measure". An
 * empty period showing a 0% take rate reads as "the business earns nothing",
 * which is a different and much worse statement than "nothing sold".
 */
export type Rate = number | null;

export interface AdminMetrics {
  range: { from: string; to: string };
  generatedAt: string;

  revenue: {
    /** Gross merchandise value — everything buyers paid. */
    gmv: number;
    /** What CrowdPass keeps. */
    platformFee: number;
    gatewayFee: number;
    organizerAmount: number;
    /** `0.03` = 3%. Null when nothing sold. */
    takeRate: Rate;
    transactions: number;
    averageOrderValue: number | null;
    byProvider: {
      provider: PaymentProvider;
      amount: number;
      transactions: number;
    }[];
  };

  tickets: {
    sold: number;
    checkedIn: number;
    /** How many buyers actually turned up. Null when none sold. */
    attendanceRate: Rate;
  };

  /**
   * `byStatus` is a PARTIAL record — a status with no rows is absent, not
   * zero. Read it defensively; `byStatus.CANCELLED` is legitimately
   * `undefined` on a good week.
   */
  events: {
    created: number;
    byStatus: Partial<Record<string, number>>;
  };

  users: { new: number; newOrganizers: number };

  /**
   * NOT range-scoped, deliberately: these are current standings, not flow.
   * An organizer verified last year still counts as verified today, so this
   * must never be labelled as belonging to the selected period.
   */
  kyc: { verified: number; pending: number };

  payouts: { completed: number; amount: number };
}

export interface AdminDailyPoint {
  /** `YYYY-MM-DD` */
  day: string;
  gmv: number;
  transactions: number;
}

export interface AdminOps {
  windowHours: number;
  stuckAfterMinutes: number;
  generatedAt: string;

  notifications: {
    sent24h: number;
    failed24h: number;
    /** Share, not count — the number that surfaces a provider outage. */
    failureRate: Rate;
    stuckPending: number;
  };

  blockchain: { failed24h: number; stuckPending: number };

  webhooks: {
    invalidSignature24h: number;
    errored24h: number;
    unprocessed: number;
  };

  kyc: { stranded: number; failed24h: number };

  payments: {
    /**
     * Buyers who paid and have no ticket. **This is the alarm** — every one
     * is someone out of pocket with nothing to show for it.
     */
    paidAwaitingMint: number;
    /**
     * Checkouts started and never paid. Informational: a healthy funnel
     * always has some. Belongs next to conversion on the metrics page, never
     * in an incident list beside `paidAwaitingMint`, and never summed with it.
     */
    abandonedCheckouts: number;
  };
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export type HealthState = "up" | "down";

/**
 * Each indicator carries `status` plus arbitrary extra keys — block heights
 * for `blockchain`, per-queue depths for `queues`, the wallet set id for
 * `circle`. The extras are the interesting part of a status page that cannot
 * report uptime, so they are kept rather than narrowed away.
 */
export interface HealthIndicator {
  status: HealthState;
  [key: string]: unknown;
}

export interface HealthReport {
  status: "ok" | "error" | "shutting_down";
  info: Record<string, HealthIndicator>;
  error: Record<string, HealthIndicator>;
  details: Record<string, HealthIndicator>;
}

/** Queue depths, as `queues` reports them per Bull queue. */
export interface QueueDepth {
  name: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  healthy: boolean;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: "BUYER" | "ORGANIZER" | "ADMIN";
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}
