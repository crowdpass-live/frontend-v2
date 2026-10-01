import "server-only";

import { cache } from "react";
import { getCurrentUser, getDoorEvents } from "./session";
import { fetchOrganizerEvents, ORGANIZER_EVENTS_MAX_LIMIT, settle } from "./organizer";

/**
 * One door this account may work: an event it owns, or one an organizer
 * delegated to it.
 */
export interface DoorEvent {
  eventId: string;
  name: string;
  startTime: string;
  endTime: string | null;
  venue: string | null;
  location: string | null;
  /** Shown to a delegate: whose door this is. Null for the owner's own. */
  organizerName: string | null;
  own: boolean;
}

/**
 * Every door this account may work, or null when that could not be asked.
 *
 * Two sources, because the backend's own rule has two branches
 * (`CheckinAccessService.canScanEvent`): the event's OWNER may always scan
 * it, and so may anyone holding an active `EventTicketAdmin` grant.
 * `my-checkin-events` returns only the grants — an organizer's own events
 * are not in it — so an organizer's live events are added from
 * `GET /organizer/events`. Delegates are plain BUYERs; the door is never
 * gated on the role alone.
 */
export const getDoors = cache(async (): Promise<DoorEvent[] | null> => {
  const [user, grants] = await Promise.all([getCurrentUser(), getDoorEvents()]);
  if (!user || grants === null) return null;

  const doors = new Map<string, DoorEvent>();

  // `@Roles(ORGANIZER)` only — an ADMIN's 403 here just means no own events.
  if (user.isOrganizer) {
    const own = await settle(
      fetchOrganizerEvents({ status: "PUBLISHED", limit: ORGANIZER_EVENTS_MAX_LIMIT }),
    );
    if (own.ok) {
      for (const e of own.value.events) {
        doors.set(e.id, {
          eventId: e.id,
          name: e.name,
          startTime: e.startTime,
          endTime: e.endTime,
          venue: null,
          location: null,
          organizerName: null,
          own: true,
        });
      }
    }
  }

  for (const g of grants) {
    if (doors.has(g.eventId)) continue;
    doors.set(g.eventId, {
      eventId: g.eventId,
      name: g.name,
      startTime: g.startTime,
      endTime: g.endTime,
      venue: g.venue,
      location: g.location,
      organizerName: g.organizerName,
      own: false,
    });
  }

  return [...doors.values()];
});
