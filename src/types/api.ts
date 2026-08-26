/**
 * Wire types for the CrowdPass backend (`backend-v2`, NestJS).
 *
 * Hand-mirrored from the Prisma enums in `backend-v2/prisma/schema.prisma`
 * and the response shapes in `events.service.ts` / `tickets.service.ts`.
 * There is no generated client, so when the backend adds an enum member or
 * a response field, it has to be added here too — a missing enum member
 * shows up as a `never` in a switch rather than as a runtime surprise.
 */

export type EventCategory =
  | "CONCERT"
  | "CONFERENCE"
  | "WORKSHOP"
  | "PARTY"
  | "CORPORATE"
  | "SPORTS"
  | "OTHER";

export type PaymentProvider = "PAYSTACK" | "MONNIFY" | "BLOCKRADAR" | "CRYPTO";

export type DeliveryChannel = "EMAIL" | "SMS" | "WHATSAPP";

export type TicketStatus =
  | "PENDING"
  | "CONFIRMED"
  | "USED"
  | "CANCELLED"
  | "REFUNDED";

export type TransactionStatus = "PENDING" | "SUCCESS" | "FAILED";

/** Every non-download route is wrapped by the backend's TransformInterceptor. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * A ticket tier as returned by `GET /events/:slug`.
 *
 * `available` and `isOnSale` are computed server-side and already account for
 * `reservedCount` — seats held part-way through a WhatsApp purchase Flow are
 * not for sale on the web. Never recompute availability from
 * `quantity - soldCount` on the client; that number oversells.
 */
export interface ApiTicketType {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  quantity: number;
  soldCount: number;
  reservedCount: number;
  maxPerUser: number;
  salesStartDate: string | null;
  salesEndDate: string | null;
  available: number;
  isOnSale: boolean;
}

export interface ApiEvent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: EventCategory;
  venue: string | null;
  location: string | null;
  coverImage: string | null;
  startTime: string;
  endTime: string | null;
  purchaseStartTime: string | null;
  currency: string;
  country: string | null;
  chain: string | null;
  isFree: boolean;
  isRefundable: boolean;
  acceptsCrypto: boolean;
  status: string;
  ticketTypes: ApiTicketType[];
  organizer: { id: string; firstName: string | null; lastName: string | null };
}

/**
 * An event as it appears in `GET /events` (the list), which is a different
 * shape from `GET /events/:slug` (the detail):
 *
 *   - `minPrice` and `totalAvailable` are computed and added by the list
 *     endpoint only.
 *   - `ticketTypes` is a thin projection — no `id`, so a list item can never
 *     be used to start a purchase. The checkout page re-reads the detail.
 */
export interface ApiEventListItem
  extends Omit<ApiEvent, "ticketTypes" | "organizer"> {
  minPrice: number;
  totalAvailable: number;
  ticketTypes: {
    name: string;
    price: string | number;
    quantity: number;
    soldCount: number;
    reservedCount: number;
  }[];
  organizer: { id: string; firstName: string | null; lastName: string | null };
}

export interface ApiEventList {
  events: ApiEventListItem[];
  /**
   * Note the key: the backend returns `pagination`, not `meta`. The mobile
   * app reads `meta` here and silently gets null.
   */
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export type FiatMethodCode =
  | "CARD"
  | "BANK_TRANSFER"
  | "USSD"
  | "APPLE_PAY"
  | (string & {});

export interface ApiFiatMethod {
  type: "fiat";
  provider: Exclude<PaymentProvider, "CRYPTO">;
  methods: FiatMethodCode[];
  default?: boolean;
}

export interface ApiCryptoMethod {
  type: "crypto";
  tokens: string[];
}

export interface ApiPaymentMethods {
  currency: string | null;
  country: string | null;
  methods: (ApiFiatMethod | ApiCryptoMethod)[];
}

/** `GET /payments/verify?reference=` — idempotent, safe to poll. */
export interface ApiVerifyResult {
  reference: string;
  status: TransactionStatus;
  settled: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

/**
 * `POST /tickets/purchase`. The response is a union in practice — which
 * fields are populated depends on the lane the purchase took:
 *
 *   free events        -> `free: true`, no checkoutUrl
 *   crypto, funded     -> `paidFromBalance: true`, `crypto: null`
 *   crypto, short      -> `crypto` carries the deposit instruction
 *   fiat               -> `checkoutUrl` to redirect the buyer to
 */
export interface ApiPurchaseResult {
  reference: string;
  checkoutUrl: string | null;
  providerReference?: string;
  amount: number;
  platformFee?: number;
  organizerAmount?: number;
  currency: string;
  provider: PaymentProvider;
  tickets: { id: string; reference: string; status: TicketStatus }[];
  free: boolean;
  paidFromBalance?: boolean;
  crypto?: {
    address: string;
    token: string;
    amount: string;
    chain: string;
  } | null;
}

export interface ApiTicket {
  id: string;
  reference: string;
  status: TicketStatus;
  qrCode: string | null;
  tokenId: string | number | null;
  checkedInAt: string | null;
  buyerName: string | null;
  buyerEmail?: string | null;
  deliveryChannel: DeliveryChannel;
  createdAt: string;
  ticketType: {
    name: string;
    description: string | null;
    price: string | number;
  };
  event: {
    id: string;
    name: string;
    slug: string;
    venue: string | null;
    location: string | null;
    startTime: string;
    endTime: string | null;
    coverImage: string | null;
    organizer: { firstName: string | null; lastName: string | null } | null;
  };
}
