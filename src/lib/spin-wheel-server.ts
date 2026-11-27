import "server-only";

import { ApiError, apiFetch } from "./api";
import type { SpinCampaign } from "./spin-wheel";

/**
 * The event's prize wheel, or null when it has none. Public data (no
 * session): the door pages only need its id and slug.
 */
export async function getSpinCampaignForEvent(eventId: string): Promise<SpinCampaign | null> {
  try {
    return await apiFetch<SpinCampaign>(`/spin-wheel/events/${encodeURIComponent(eventId)}`, {
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
