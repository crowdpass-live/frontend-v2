import "server-only";

import { serverFetch } from "./api-server";
import type { ApiOrganizerEvents, EventStatus } from "@/types/api";

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
