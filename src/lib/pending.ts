/**
 * The last purchase this browser started, kept in `localStorage`.
 *
 * A guest buyer has no account, so if they close the tab mid-payment there is
 * nothing server-side tying them back to their order — the transaction
 * reference exists only in the gateway's redirect URL. This is the safety net
 * that lets `/checkout/callback` recover an order when the reference is
 * missing from the query string.
 *
 * It holds nothing sensitive: a reference, an event name, an amount. The
 * reference alone can't move money — it can only be handed to
 * `GET /payments/verify`, which the buyer is entitled to call for their own
 * order anyway.
 */

const KEY = "crowdpass.pending-purchase";

/** Longer than the gateway's own checkout expiry, so we never forget first. */
const TTL_MS = 2 * 60 * 60 * 1000;

export interface PendingPurchase {
  reference: string;
  eventSlug: string;
  eventName: string;
  amount: number;
  currency: string;
  /** First ticket in the order — where to send the buyer once it settles. */
  ticketReference: string | null;
  startedAt: number;
}

/**
 * `useSyncExternalStore` plumbing.
 *
 * `localStorage` is a client-only store that a server render cannot see, so
 * reading it in an effect and calling `setState` would flash the wrong UI for
 * one render. This is the primitive React provides for the case: the server
 * snapshot is `null`, the client snapshot is the stored order, and the
 * subscription covers a clear happening in this tab or another one.
 */
const CHANGED_EVENT = "crowdpass:pending-purchase-changed";

// getSnapshot must return a STABLE reference for unchanged data, or React
// re-renders forever. Cache against the raw string it was parsed from.
let cachedRaw: string | null = null;
let cachedValue: PendingPurchase | null = null;

function notifyChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGED_EVENT));
  }
}

export function subscribePendingPurchase(onChange: () => void): () => void {
  window.addEventListener(CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getPendingPurchaseSnapshot(): PendingPurchase | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = readPendingPurchase();
  }
  return cachedValue;
}

/** The server has no storage to read, so there is never a pending order. */
export function getPendingPurchaseServerSnapshot(): PendingPurchase | null {
  return null;
}

export function rememberPendingPurchase(
  purchase: Omit<PendingPurchase, "startedAt">,
): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...purchase, startedAt: Date.now() }),
    );
    notifyChanged();
  } catch {
    // Private mode, disabled site data, quota. The callback page still works
    // from the query string; this is only the fallback for when it doesn't.
  }
}

export function readPendingPurchase(): PendingPurchase | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPurchase>;
    if (typeof parsed?.reference !== "string" || !parsed.reference) return null;
    if (
      typeof parsed.startedAt !== "number" ||
      Date.now() - parsed.startedAt > TTL_MS
    ) {
      clearPendingPurchase();
      return null;
    }
    return parsed as PendingPurchase;
  } catch {
    return null;
  }
}

export function clearPendingPurchase(): void {
  try {
    localStorage.removeItem(KEY);
    notifyChanged();
  } catch {
    // Nothing to do — a stale entry expires on its own via TTL_MS.
  }
}
