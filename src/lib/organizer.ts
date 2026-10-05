import "server-only";

import { cache } from "react";
import { serverFetch } from "./api-server";
import { fetchEventBySlug } from "./crowdpass";
import { claimEntriesPath } from "./claim-list";
import { apiFetch } from "./api";
import type {
  ApiAttendees,
  ApiBank,
  ApiBankHistory,
  ApiClaimList,
  ApiEvent,
  ApiTicketType,
  ApiBeneficiaryEarnings,
  ApiEventAnalytics,
  ApiKycStatus,
  ApiOnchainBalance,
  ApiOnchainCheckins,
  ApiOrganizerEvents,
  ApiPayouts,
  ApiTicketAdmin,
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

/**
 * `GET /organizer/kyc` — `@Roles(ORGANIZER)`, so an ADMIN gets 403 here too.
 * The verdict of any check is read from this, never from a client callback.
 */
export function fetchKycStatus() {
  return serverFetch<ApiKycStatus>("/organizer/kyc", { timeout: 45_000 });
}

/** `GET /organizer/banks` — Paystack's live list; callers fall back to NG_BANKS. */
export function fetchBanks() {
  return serverFetch<ApiBank[]>("/organizer/banks", { timeout: 30_000 });
}

/** `GET /organizer/bank-details/history` — newest first. */
export function fetchBankHistory(limit = 10) {
  return serverFetch<ApiBankHistory>(`/organizer/bank-details/history?limit=${limit}`, {
    timeout: 30_000,
  });
}

/**
 * The chain each event settles on, for explorer links on payouts.
 *
 * A payout carries `eventId` but not the chain, and events are only readable
 * by slug. So: map id -> slug through the organizer's own events, then read
 * each distinct event's public page. Payouts exist only for crypto events,
 * so this is a handful of reads, and the public read is cached for 30s.
 * An event that cannot be resolved maps to nothing — the hash is then shown
 * without a link, never linked to a guessed chain.
 *
 * Simpler once `chain` is on the payout DTO (a one-line backend change).
 */
export async function chainsForEvents(eventIds: string[]): Promise<Map<string, string>> {
  const wanted = new Set(eventIds);
  const chains = new Map<string, string>();
  if (!wanted.size) return chains;

  const own = await settle(fetchOrganizerEvents({ limit: ORGANIZER_EVENTS_MAX_LIMIT }));
  if (!own.ok) return chains;
  const slugs = own.value.events.filter((e) => wanted.has(e.id));

  await Promise.all(
    slugs.map(async (e) => {
      const detail = await settle(fetchEventBySlug(e.slug));
      if (detail.ok && detail.value.chain) chains.set(e.id, detail.value.chain);
    }),
  );
  return chains;
}

export function fetchBeneficiaryEarnings() {
  return serverFetch<ApiBeneficiaryEarnings>("/organizer/beneficiary-earnings", {
    timeout: 45_000,
  });
}

// ---------------------------------------------------------------------------
// Member lists (claim-only ticket types)
// ---------------------------------------------------------------------------

/** How many pages of 50 to scan for an event before giving up. */
const OWN_EVENT_SCAN_PAGES = 10;

/**
 * The organizer's own summary row for an event (slug and status), by id.
 * The analytics response carries neither, and ticket types are only
 * readable through the slug (published) or the drafts list. Deduplicated
 * per request: the overview page asks for both controls and ticket types.
 */
export const findOwnEvent = cache(async (eventId: string) => {
  for (let page = 1; page <= OWN_EVENT_SCAN_PAGES; page++) {
    const res = await fetchOrganizerEvents({ page, limit: ORGANIZER_EVENTS_MAX_LIMIT });
    const hit = res.events.find((e) => e.id === eventId);
    if (hit) return hit;
    if (page >= res.pagination.totalPages) break;
  }
  return null;
});

/**
 * What the publish / cancel controls need about one of the caller's events:
 * its slug, status, sales, and whether it's refundable — the last decides
 * whether cancelling is even allowed once tickets are sold. `isRefundable`
 * lives on the event, which has no organizer read: the drafts list for a
 * draft, the public read for a published event. Null if it isn't theirs.
 */
export async function fetchEventControls(eventId: string): Promise<{
  slug: string;
  status: EventStatus;
  ticketsSold: number;
  isRefundable: boolean;
} | null> {
  const own = await findOwnEvent(eventId);
  if (!own) return null;
  let isRefundable = false;
  if (own.status === "PUBLISHED") {
    const event = await apiFetch<ApiEvent>(`/events/${encodeURIComponent(own.slug)}`, {
      cache: "no-store",
      timeout: 45_000,
    });
    isRefundable = event.isRefundable;
  } else if (own.status === "DRAFT") {
    isRefundable = !!(await fetchOwnDraft(eventId))?.isRefundable;
  }
  return { slug: own.slug, status: own.status, ticketsSold: own.stats.ticketsSold, isRefundable };
}

/**
 * An event's ticket types, with ids and `claimOnly` — the same sources
 * mobile's `fetchOwnEventTiers` uses: the public event for a published
 * event, the drafts list for a draft. Ended and cancelled events have no
 * readable source, and their lists no longer matter: returns null.
 *
 * Uncached on purpose. The public read elsewhere revalidates every 30s,
 * which would show a tier as still on sale right after its first upload.
 */
export async function fetchOwnTicketTypes(eventId: string): Promise<{
  status: EventStatus;
  ticketTypes: ApiTicketType[];
} | null> {
  const own = await findOwnEvent(eventId);
  if (!own) return null;

  if (own.status === "PUBLISHED") {
    const event = await apiFetch<ApiEvent>(`/events/${encodeURIComponent(own.slug)}`, {
      cache: "no-store",
      timeout: 45_000,
    });
    return { status: own.status, ticketTypes: event.ticketTypes };
  }
  if (own.status === "DRAFT") {
    const drafts = await serverFetch<(ApiEvent & { ticketTypes: ApiTicketType[] })[]>(
      "/events/me/drafts",
      { timeout: 45_000 },
    );
    const draft = drafts.find((d) => d.id === eventId);
    return draft ? { status: own.status, ticketTypes: draft.ticketTypes } : null;
  }
  return { status: own.status, ticketTypes: [] };
}

/** `GET /events/chains` — public; the create form's settlement-chain options. */
export function fetchChains() {
  return apiFetch<{ id: string; displayName: string; isTestnet: boolean }[]>("/events/chains", {
    next: { revalidate: 300 },
    timeout: 20_000,
  });
}

/**
 * One of the caller's DRAFT events, in full, for the edit form — a draft has
 * no public read, so it comes from `GET /events/me/drafts`. Null when the id
 * isn't one of their drafts (published, someone else's, or gone).
 */
export async function fetchOwnDraft(eventId: string) {
  const drafts = await serverFetch<(ApiEvent & { ticketTypes: ApiTicketType[] })[]>("/events/me/drafts", {
    timeout: 45_000,
  });
  return drafts.find((d) => d.id === eventId) ?? null;
}

/** `@Roles(ORGANIZER)` plus ownership — an ADMIN gets 403 here. */
export function fetchClaimList(eventId: string, ticketTypeId: string) {
  return serverFetch<ApiClaimList>(claimEntriesPath(eventId, ticketTypeId), {
    timeout: 45_000,
  });
}

// ---------------------------------------------------------------------------
// Check-in team (#48)
// ---------------------------------------------------------------------------

/** `GET /organizer/events/:id/ticket-admins` — active delegates only. */
export function fetchTicketAdmins(eventId: string) {
  return serverFetch<ApiTicketAdmin[]>(
    `/organizer/events/${encodeURIComponent(eventId)}/ticket-admins`,
    { timeout: 45_000 },
  );
}
