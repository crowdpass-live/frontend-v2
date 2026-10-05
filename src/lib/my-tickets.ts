import "server-only";

import { serverFetch } from "./api-server";
import type { Pagination, TicketStatus } from "@/types/api";

/**
 * `GET /tickets/mine` — the signed-in buyer's tickets (#25). Ports what
 * `v2-mobile/src/screens/MyTicketsScreen.js` reads.
 *
 * Normalised into `MyTicket` rather than typed as the raw row, because this
 * list has no web consumer to pin its shape against yet: the reader takes
 * the event and tier from either a nested object or flat fields, and the
 * page from either `pagination` or `meta`. Every row still lands on the one
 * `/tickets/[reference]` page, which owns the QR, the mint wait, download
 * and share.
 */

/** The backend caps `limit` at 50. */
export const MY_TICKETS_PAGE_SIZE = 20;

export interface MyTicket {
  reference: string;
  status: TicketStatus;
  tierName: string;
  eventName: string;
  eventStart: string | null;
  venue: string;
  coverImage: string | null;
}

export interface MyTickets {
  tickets: MyTicket[];
  pagination: Pagination;
}

type Loose = Record<string, unknown>;
const isObject = (v: unknown): v is Loose => !!v && typeof v === "object" && !Array.isArray(v);
const str = (...c: unknown[]) => {
  for (const v of c) if (typeof v === "string" && v) return v;
  return "";
};
const STATUSES: TicketStatus[] = ["PENDING", "CONFIRMED", "USED", "CANCELLED", "REFUNDED"];

function toTicket(raw: unknown): MyTicket | null {
  if (!isObject(raw)) return null;
  const reference = str(raw.reference);
  if (!reference) return null;
  const event = isObject(raw.event) ? raw.event : {};
  const tier = isObject(raw.ticketType) ? raw.ticketType : {};
  const status = STATUSES.includes(raw.status as TicketStatus)
    ? (raw.status as TicketStatus)
    : "PENDING";
  return {
    reference,
    status,
    tierName: str(tier.name, raw.ticketTypeName, raw.ticketType),
    eventName: str(event.name, raw.eventName) || "Event",
    eventStart: str(event.startTime, raw.eventStartTime, raw.startTime) || null,
    venue: [str(event.venue, raw.venue), str(event.location, raw.location)]
      .filter(Boolean)
      .join(" · "),
    coverImage: str(event.coverImage, raw.coverImage) || null,
  };
}

export async function fetchMyTickets(page = 1, limit = MY_TICKETS_PAGE_SIZE): Promise<MyTickets> {
  const raw = await serverFetch<unknown>(`/tickets/mine?page=${page}&limit=${limit}`);
  const body = isObject(raw) ? raw : {};
  const list = Array.isArray(raw)
    ? raw
    : [body.tickets, body.data, body.items].find(Array.isArray) ?? [];
  const tickets = (list as unknown[]).map(toTicket).filter((t): t is MyTicket => !!t);

  const p = isObject(body.pagination) ? body.pagination : isObject(body.meta) ? body.meta : {};
  const total = typeof p.total === "number" ? p.total : tickets.length;
  const pageSize = typeof p.limit === "number" && p.limit > 0 ? p.limit : limit;
  return {
    tickets,
    pagination: {
      page: typeof p.page === "number" ? p.page : page,
      limit: pageSize,
      total,
      totalPages:
        typeof p.totalPages === "number" ? p.totalPages : Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
