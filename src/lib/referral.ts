/**
 * Referral attribution, the frontend's half (#50).
 *
 * A sale is credited to the LAST referral link the buyer opened for that
 * event, until the link expires. The server can't see clicks, so the
 * browser keeps them: `/r/:code` stores `{ code, expiresAt }` per event,
 * overwriting any earlier one, and checkout sends the code. The server only
 * checks it still qualifies — a stale or bad code just leaves the sale
 * unattributed, it never blocks it.
 *
 * Storage can throw (private browsing, blocked site data); every access is
 * guarded so the purchase works regardless.
 */

const key = (eventId: string) => `crowdpass:ref:${eventId}`;

export interface StoredReferral {
  code: string;
  /** ISO; the link's own expiry or the event end. */
  expiresAt: string | null;
}

export function saveReferral(eventId: string, ref: StoredReferral): void {
  try {
    localStorage.setItem(key(eventId), JSON.stringify(ref));
  } catch {
    // Unattributed is the worst case.
  }
}

/**
 * The code to send at checkout for this event, or null. Kept after a
 * purchase: a second purchase through the same link is credited too.
 */
export function referralCodeFor(eventId: string, now = Date.now()): string | null {
  try {
    const raw = localStorage.getItem(key(eventId));
    if (!raw) return null;
    const ref = JSON.parse(raw) as Partial<StoredReferral>;
    if (typeof ref.code !== "string" || !ref.code) return null;
    if (ref.expiresAt && new Date(ref.expiresAt).getTime() <= now) return null;
    // `PurchaseTicketDto` caps it at 32.
    return ref.code.slice(0, 32);
  } catch {
    return null;
  }
}
