import "server-only";

import { cache } from "react";
import { serverFetch } from "./api-server";
import type {
  ApiAttendees,
  ApiBeneficiaryEarnings,
  ApiEventAnalytics,
  ApiOnchainBalance,
  ApiOnchainCheckins,
  ApiOrganizerEvents,
  ApiPayouts,
  EventStatus,
  TicketStatus,
} from "@/types/api";

/**
 * Organizer reads for server components. Authenticated through the session
 * cookie (`serverFetch`), never cached — these are one organizer's numbers.
 */

/** `QueryOrganizerEventsDto` caps `limit` at 50; anything higher 400s. */
export const ORGANIZER_EVENTS_MAX_LIMIT = 50;

export const EVENT_STATUSES: EventStatus[] = [
  "PUBLISHED",
  "DRAFT",
  "COMPLETED",
  "CANCELLED",
];

export function isEventStatus(v: unknown): v is EventStatus {
  return EVENT_STATUSES.includes(v as EventStatus);
}

/**
 * `GET /organizer/events` — the caller's events with per-event stats, plus a
 * summary across ALL of them regardless of `status` or page.
 *
 * `@Roles(ORGANIZER)` only: an ADMIN, who passes the `(host)` gate, gets 403
 * here. Callers handle that rather than treating it as an outage.
 */
export function fetchOrganizerEvents(query: {
  status?: EventStatus;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  params.set(
    "limit",
    String(Math.min(query.limit ?? 10, ORGANIZER_EVENTS_MAX_LIMIT)),
  );
  return serverFetch<ApiOrganizerEvents>(`/organizer/events?${params}`, {
    // Cold starts; the dashboard is the first thing an organizer opens.
    timeout: 45_000,
  });
}

// ---------------------------------------------------------------------------
// One event's control room
// ---------------------------------------------------------------------------

/**
 * Settles a request to a value or the error, so one failing read (an RPC
 * hiccup on the on-chain side) does not take the page down with it. Auth
 * failures still redirect inside `serverFetch` before reaching here.
 */
export async function settle<T>(p: Promise<T>): Promise<
  { ok: true; value: T } | { ok: false; error: unknown }
> {
  try {
    return { ok: true, value: await p };
  } catch (error) {
    // `redirect()` throws to unwind; it must keep unwinding.
    if (isRedirect(error)) throw error;
    return { ok: false, error };
  }
}

function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

/**
 * Deduplicated per request: the event layout (for the header) and its pages
 * both need it, and `apiFetch`'s abort signal opts out of Next's own fetch
 * memoization.
 */
export const fetchEventAnalytics = cache((eventId: string) =>
  serverFetch<ApiEventAnalytics>(
    `/organizer/events/${encodeURIComponent(eventId)}/analytics`,
    { timeout: 45_000 },
  ),
);

/** Reads the chain per ticket type over RPC — slower, and can fail alone. */
export function fetchOnchainBalance(eventId: string) {
  return serverFetch<ApiOnchainBalance>(
    `/organizer/events/${encodeURIComponent(eventId)}/onchain/balance`,
    { timeout: 45_000 },
  );
}

export function fetchOnchainCheckins(eventId: string) {
  return serverFetch<ApiOnchainCheckins>(
    `/organizer/events/${encodeURIComponent(eventId)}/onchain/checkins`,
    { timeout: 45_000 },
  );
}

/** `QueryAttendeesDto` defaults to 50 and caps at 200. */
export const ATTENDEES_PAGE_SIZE = 50;

export const TICKET_STATUSES: TicketStatus[] = [
  "CONFIRMED",
  "USED",
  "PENDING",
  "CANCELLED",
  "REFUNDED",
];

export function isTicketStatus(v: unknown): v is TicketStatus {
  return TICKET_STATUSES.includes(v as TicketStatus);
}

/**
 * `GET /organizer/events/:id/attendees` — the SENSITIVE tier (buyer email and
 * phone). Organizer surfaces only; never a door.
 */
export function fetchAttendees(
  eventId: string,
  query: { status?: TicketStatus; search?: string; page?: number },
) {
  const params = new URLSearchParams({ limit: String(ATTENDEES_PAGE_SIZE) });
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return serverFetch<ApiAttendees>(
    `/organizer/events/${encodeURIComponent(eventId)}/attendees?${params}`,
    { timeout: 45_000 },
  );
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export const PAYOUTS_PAGE_SIZE = 20;

export function fetchPayouts(page = 1) {
  const params = new URLSearchParams({ limit: String(PAYOUTS_PAGE_SIZE) });
  if (page > 1) params.set("page", String(page));
  return serverFetch<ApiPayouts>(`/organizer/payouts?${params}`, {
    timeout: 45_000,
  });
}

export function fetchBeneficiaryEarnings() {
  return serverFetch<ApiBeneficiaryEarnings>("/organizer/beneficiary-earnings", {
    timeout: 45_000,
  });
}
