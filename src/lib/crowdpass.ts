import { ApiError, apiFetch } from "./api";
import type {
  ApiEvent,
  ApiEventList,
  EventCategory,
  ApiFiatMethod,
  ApiCryptoMethod,
  ApiPaymentMethods,
  ApiPurchaseResult,
  ApiTicket,
  ApiVerifyResult,
  DeliveryChannel,
  PaymentProvider,
} from "@/types/api";

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface EventQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: EventCategory;
  location?: string;
  /** ISO date. Events starting before this are excluded. */
  startDate?: string;
}

/**
 * `GET /events` — the public browse/search list.
 *
 * Note what the caller has to supply: the endpoint does NOT exclude events
 * that have already happened, and it sorts by `startTime` ascending, so an
 * unfiltered first page is the *oldest* events in the database — the ones
 * whose sales closed months ago. Callers wanting a browse experience must
 * pass `startDate` (see `fetchUpcomingEvents`).
 */
export function fetchEvents(query: EventQuery = {}): Promise<ApiEventList> {
  const params = new URLSearchParams();
  params.set("page", String(query.page ?? 1));
  params.set("limit", String(query.limit ?? 12));
  if (query.search) params.set("search", query.search);
  if (query.category) params.set("category", query.category);
  if (query.location) params.set("location", query.location);
  if (query.startDate) params.set("startDate", query.startDate);

  return apiFetch<ApiEventList>(`/events?${params.toString()}`, {
    // Short revalidate: the list carries `totalAvailable`, and a long cache
    // would advertise a sold-out event as having seats. `no-store` would cost
    // a round trip on every flyer-driven visit for no real gain.
    next: { revalidate: 30 },
  });
}

/**
 * Events that haven't started yet, soonest first.
 *
 * `startDate` is the current time rather than midnight: an event that began an
 * hour ago cannot be bought (the backend closes sales at `startTime`), so
 * listing it would be an invitation to a dead end.
 */
export function fetchUpcomingEvents(
  query: Omit<EventQuery, "startDate"> = {},
): Promise<ApiEventList> {
  return fetchEvents({ ...query, startDate: new Date().toISOString() });
}

/**
 * `GET /events/:slug` — public, published events only.
 *
 * Revalidated rather than cached forever: `available` and `isOnSale` are
 * computed per-request server-side, so a fully static page would advertise a
 * sold-out tier as available. 30s is short enough that the tier list is
 * honest and long enough to absorb a flyer-driven traffic spike, and the
 * checkout page re-reads the live figures before taking money regardless.
 */
export function fetchEventBySlug(slug: string): Promise<ApiEvent> {
  return apiFetch<ApiEvent>(`/events/${encodeURIComponent(slug)}`, {
    next: { revalidate: 30, tags: [`event:${slug}`] },
  });
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export interface PaymentOptions {
  currency: string | null;
  fiat: ApiFiatMethod | null;
  crypto: ApiCryptoMethod | null;
}

/**
 * `GET /payments/methods?eventId=` — which rails this event can actually
 * take money on.
 *
 * The backend only lists a fiat provider when the organizer has a *real*
 * subaccount (placeholder codes from the dev enable flow are filtered out),
 * so anything returned here is safe to offer. Never hardcode PAYSTACK as a
 * fallback: offering a provider the organizer hasn't enabled hands the buyer
 * a button that always fails at gateway init.
 */
export async function fetchPaymentMethods(
  eventId: string,
): Promise<PaymentOptions> {
  const data = await apiFetch<ApiPaymentMethods>(
    `/payments/methods?eventId=${encodeURIComponent(eventId)}`,
  );
  const methods = data?.methods ?? [];
  return {
    currency: data?.currency ?? null,
    fiat: (methods.find((m) => m.type === "fiat") as ApiFiatMethod) ?? null,
    crypto:
      (methods.find((m) => m.type === "crypto") as ApiCryptoMethod) ?? null,
  };
}

/**
 * `GET /payments/verify?reference=` — idempotent settlement check.
 *
 * This is not merely a read: it settles the transaction if the provider
 * webhook hasn't arrived, which is the whole reason the buyer's return trip
 * polls it. `PENDING` is a normal steady state, never a failure — bank
 * transfer and USSD legitimately take minutes.
 */
export function verifyPayment(reference: string): Promise<ApiVerifyResult> {
  return apiFetch<ApiVerifyResult>(
    `/payments/verify?reference=${encodeURIComponent(reference)}`,
    { timeout: 60_000, cache: "no-store" },
  );
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export interface PurchasePayload {
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  buyerEmail: string;
  buyerName: string;
  buyerPhone?: string;
  deliveryChannel: DeliveryChannel;
  paymentProvider: PaymentProvider;
  returnUrl?: string;
}

/**
 * `POST /tickets/purchase` — the guest purchase endpoint.
 *
 * Public (`@Public() + OptionalJwtAuthGuard`): no account, no token. The
 * backend upserts a User row by email so the mint worker has a wallet to mint
 * into, which is why `buyerEmail` is the identity here and has to be right —
 * it is also where the ticket is delivered.
 *
 * Long timeout: this call initializes the transaction with Paystack or
 * Monnify, so it waits on a third party before it can answer. A timeout does
 * NOT mean the purchase failed — see `CheckoutForm` for the recovery.
 *
 * `returnUrl` is retried away rather than feature-flagged. The backend runs
 * `ValidationPipe({ forbidNonWhitelisted: true })`, so a deployment that
 * predates the `returnUrl` DTO field rejects the whole purchase with
 * `"property returnUrl should not exist"` — which would break every sale on
 * this site the moment it went live ahead of the API. Feature-detecting it
 * here means the frontend can ship first and starts using the field the
 * moment the API supports it, with no flag for anyone to remember to flip.
 *
 * Retrying is safe in this one case and only this one: validation runs before
 * the controller, so the rejected attempt provably created no transaction and
 * reserved no seat. Never retry a purchase on any other error.
 */
export async function purchaseTicket(
  payload: PurchasePayload,
): Promise<ApiPurchaseResult> {
  const post = (body: PurchasePayload) =>
    apiFetch<ApiPurchaseResult>("/tickets/purchase", {
      method: "POST",
      body,
      timeout: 60_000,
    });

  try {
    return await post(payload);
  } catch (err) {
    if (
      payload.returnUrl &&
      err instanceof ApiError &&
      err.rejectedProperty("returnUrl")
    ) {
      // Fall back to the API's own callback page. The buyer still pays and
      // still settles — they just land on the backend's result page instead
      // of ours until the API catches up.
      const { returnUrl: _dropped, ...rest } = payload;
      void _dropped;
      return post(rest);
    }
    throw err;
  }
}

/**
 * `GET /tickets/:reference` — public single-ticket lookup.
 *
 * Public by design: a guest buyer has no account, so the reference in their
 * confirmation email is the only key they hold. That makes the reference
 * bearer-grade — treat the ticket URL as the ticket.
 */
export function fetchTicketByReference(reference: string): Promise<ApiTicket> {
  return apiFetch<ApiTicket>(`/tickets/${encodeURIComponent(reference)}`, {
    cache: "no-store",
  });
}
