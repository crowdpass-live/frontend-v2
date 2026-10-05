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
 *
 * `claimOnly`: this tier is never buyable through `POST /tickets/purchase` —
 * the backend rejects it outright regardless of price or provider. The only
 * way to obtain one is `POST /tickets/claim` with a matNo + full name the
 * organizer has pre-imported. `available`/`isOnSale` still mean what they
 * always mean for a claim-only tier (seats left / within the sale window).
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
  claimOnly: boolean;
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
  /** Read through `normalizeCryptoDeposit()` — the field names have moved. */
  crypto?: {
    chain: string;
    address: string;
    amountUsdc?: string;
    usdcAddress?: string;
    decimals?: number;
    expiresAt?: string;
    /** Older backends. */
    amount?: string;
    token?: string;
  } | null;
}

/**
 * `POST /tickets/claim` — redeems a `claimOnly` tier's pre-imported matNo
 * entry into a real ticket. Always `CONFIRMED` at creation — no gateway, no
 * mint wait, so there is nothing to poll.
 */
export interface ApiClaimResult {
  reference: string;
  ticket: { id: string; reference: string; status: TicketStatus };
}

/**
 * `POST /tickets/claim/verify` — step one of the two-step claim form.
 * Checks a matNo + full name against the imported claim list without
 * creating anything; the only success shape is `{ valid: true }`, every
 * failure is a thrown `ApiError` (wrong name, already claimed, sold out,
 * etc. — same messages `POST /tickets/claim` would give).
 */
export interface ApiClaimVerifyResult {
  valid: true;
}

export interface ApiTicket {
  id: string;
  reference: string;
  status: TicketStatus;
  qrCode: string | null;
  tokenId: string | number | null;
  /**
   * On-chain provenance, when the API includes it (#31). All optional: read
   * through `ticketOnchain()`, which only links what it can verify.
   */
  contractAddress?: string | null;
  ownerAddress?: string | null;
  walletAddress?: string | null;
  mintTxHash?: string | null;
  txHash?: string | null;
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
    /** Not always present on this payload; the event detail has it. */
    chain?: string | null;
    organizer: { firstName: string | null; lastName: string | null } | null;
  };
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";

/** Every paginated organizer list uses this key and shape. */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Auth and the signed-in user
// ---------------------------------------------------------------------------

export type UserRole = "BUYER" | "ORGANIZER" | "ADMIN";

/** Account completeness, NOT a permission level. LITE = phone-only. */
export type UserStatus = "LITE" | "FULL";

export type KycStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type KycTier = "NONE" | "BASIC" | "ENHANCED";
export type KycIdType = "BVN" | "NIN";

/**
 * The minimal user `POST /api/session` hands back to the browser — enough to
 * route someone after sign-in, nothing more. Full detail is `ApiUser`.
 */
export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
}

/** `POST /auth/login`. `user` is the bare row (no profile, no wallets). */
export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

/**
 * `organizerProfile` as `GET /auth/me` returns it: `id`, `userId` and
 * `kycIdHash` are stripped, and `accountNumber` is MASKED — never send it
 * back as if it were the real number.
 */
export interface ApiOrganizerProfile {
  country: string;
  bankName: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
  bankVerified: boolean;
  kycTier: KycTier;
  kycStatus: KycStatus;
  kycProvider: string | null;
  kycIdType: KycIdType | null;
  /** Last 4 digits only — "NIN ending 1234". */
  kycIdLast4: string | null;
  kycVerifiedAt: string | null;
  /** Why the last attempt failed, so the UI can say what to fix. */
  kycRejectionReason: string | null;
  businessName: string | null;
  businessAddress: string | null;
  /** A `DEV_` prefix is a placeholder, not a real payment lane (#39). */
  paystackSubaccountCode: string | null;
  paystackSubaccountId: string | null;
  monnifySubAccountCode: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * One row of `KycVerification`. `PENDING` is an SDK session (liveness, or the
 * app's consent flow) whose webhook has not landed; `PROVIDER_ERROR` is an
 * outage. Neither one counts against the daily attempts.
 */
export type KycOutcome =
  | "PENDING"
  | "VERIFIED"
  | "NAME_MISMATCH"
  | "NOT_FOUND"
  | "LIVENESS_FAILED"
  | "DUPLICATE_IDENTITY"
  | "PROVIDER_ERROR";

/** `GET /organizer/kyc` — state plus what the organizer can do next. */
export interface ApiKycStatus {
  status: KycStatus;
  tier: KycTier;
  country: string;
  idType: KycIdType | null;
  idLast4: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  /** From the country registry, so the form never hardcodes them. */
  availableIdTypes: KycIdType[];
  /** Rolling 24h, out of 5. */
  attemptsRemaining: number;
  /** The names the ID is matched against. Server-owned, never typed here. */
  applicant: { firstName: string; lastName: string };
  /** A minted SDK session still waiting on its webhook — usually the app's. */
  pendingVerification: {
    reference: string | null;
    startedAt: string;
    expiresAt: string | null;
    product: string;
  } | null;
  history: {
    id: string;
    idType: KycIdType | null;
    idLast4: string | null;
    outcome: KycOutcome;
    failureReason: string | null;
    createdAt: string;
  }[];
}

/**
 * `POST /organizer/kyc/session` (201). An empty body mints liveness
 * (`liveness_nin`); `{ idType, idNumber }` mints the consent flow. The token
 * is single-use; `reference` is echoed to the SDK as `customerReference`.
 * A duplicate `sessionToken` field also comes back — ignore it.
 */
export interface ApiKycSession {
  sdkSessionToken: string;
  reference: string;
  sessionId: string;
  expiresAt: string | null;
  productCode: string;
  flow: "LIVENESS" | "CONSENT";
  status: "PENDING";
}

/**
 * `POST /organizer/kyc/verify`. Every branch is a 200 — a failed match is an
 * answer, not an error. 409 (already verified), 403 (REJECTED, or not an
 * organizer) and 429 (attempts or the per-IP throttle) arrive as errors.
 */
export type ApiKycVerifyResult =
  | {
      outcome: "VERIFIED";
      status: "VERIFIED";
      tier: KycTier;
      idType: KycIdType;
      idLast4: string;
      message: string;
    }
  | {
      /** Not a verdict: nothing was checked and no attempt was spent. */
      outcome: "CONSENT_REQUIRED";
      status: "PENDING";
      consentUrl: string;
      idType: KycIdType;
      idLast4: string;
      message: string;
    }
  | {
      outcome: "NAME_MISMATCH" | "NOT_FOUND" | "LIVENESS_FAILED";
      /** REJECTED when this attempt used up the last one. */
      status: "PENDING" | "REJECTED";
      reason: string;
      attemptsRemaining: number;
      message: string;
    };

/** `GET /organizer/banks` — live from Paystack. `code` is the `bankCode`. */
export interface ApiBank {
  name: string;
  code: string;
  slug?: string;
}

export type PayoutProvider = "PAYSTACK" | "MONNIFY";

/** One provider's result when a bank change is pushed to its subaccount. */
export interface ApiProviderSync {
  provider: PayoutProvider;
  synced: boolean;
  reason?: string;
}

/** One side of a bank change. Account numbers are masked. */
export interface ApiBankSnapshot {
  bankName: string | null;
  bankCode: string | null;
  accountNumber: string | null;
  accountName: string | null;
}

/**
 * `GET /organizer/bank-details/history` — append-only, newest first. Not the
 * shared `pagination` shape: `{ data, total, skip, limit }`.
 */
export interface ApiBankHistory {
  data: {
    id: string;
    reason: "INITIAL_SETUP" | "BANK_UPDATE" | string;
    previous: ApiBankSnapshot | null;
    current: ApiBankSnapshot;
    providers: ApiProviderSync[] | null;
    changedAt: string;
  }[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * `PUT /organizer/bank-details`. `providers` lists every enabled subaccount
 * the change was pushed to; one with `synced: false` still settles to the
 * OLD bank. (If all failed it is a 502 and nothing changed.)
 */
export interface ApiBankUpdateResult {
  bankName: string | null;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  bankVerified: boolean;
  updatedAt: string;
  providers: ApiProviderSync[];
}

/** One custodial Circle wallet. `address` is null while provisioning. */
export interface ApiWallet {
  id: string;
  address: string | null;
  chain: string;
  walletType: string;
  isPrimary: boolean;
  creationStatus: string | null;
  creationError: string | null;
  createdAt: string;
}

/**
 * `GET /auth/me` — the only place `organizerProfile` and `wallets` appear.
 * Read through `normalizeUser()` rather than directly.
 */
export interface ApiUser {
  id: string;
  /** Nullable: a WhatsApp-first account may have none. */
  email: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  organizerProfile: ApiOrganizerProfile | null;
  wallets: ApiWallet[];
}

// ---------------------------------------------------------------------------
// Organizer — dashboard and analytics (`/organizer/events…`)
// ---------------------------------------------------------------------------

/** `GET /organizer/events` — one call carries the summary and the page. */
export interface ApiOrganizerEvents {
  /** Across ALL the organizer's events, not just this page. */
  summary: {
    totalEvents: number;
    publishedEvents: number;
    /** Naira: sold count × CURRENT ticket price, not settled money. */
    totalRevenue: number;
    totalTicketsSold: number;
  };
  events: ApiOrganizerEvent[];
  pagination: Pagination;
}

export interface ApiOrganizerEvent {
  id: string;
  name: string;
  slug: string;
  coverImage: string | null;
  startTime: string;
  endTime: string | null;
  status: EventStatus;
  category: EventCategory;
  createdAt: string;
  stats: {
    totalTickets: number;
    /** CONFIRMED + USED. */
    ticketsSold: number;
    ticketsAvailable: number;
    totalRevenue: number;
    /** USED. */
    checkedIn: number;
    ticketTypes: { name: string; sold: number; total: number; revenue: number }[];
  };
}

/**
 * `GET /organizer/events/:id/analytics`.
 *
 * NOTE the backend reports `checkInRate` and `averageTicketPrice` as `0`, not
 * `null`, when nothing sold. Check `totalTicketsSold` before rendering either
 * as a figure — `0%` and "nothing to measure" are different statements.
 */
export interface ApiEventAnalytics {
  event: { id: string; name: string; status: EventStatus; startTime: string };
  overview: {
    /** Gross, from SUCCESS transactions. */
    totalRevenue: number;
    totalTicketsSold: number;
    totalTicketsAvailable: number;
    totalCheckedIn: number;
    /** Whole percent, 0–100. */
    checkInRate: number;
    averageTicketPrice: number;
  };
  /** `net + platformFee + beneficiaryTotal = gross`; `net` is after gateway fee. */
  earnings: {
    gross: number;
    net: number;
    platformFee: number;
    gatewayFee: number;
    beneficiaryTotal: number;
    beneficiaries: { userId: string; name: string; amount: number }[];
    /**
     * Fewer than `transactions` means some rows predate the split ledger,
     * and `net` is overstated by their gateway fee. Say so when it happens.
     */
    ledgerBackedTransactions: number;
    transactions: number;
  };
  /** Gap-filled from the first sale to today; empty when nothing sold. */
  dailySales: { date: string; ticketsSold: number; revenue: number }[];
  ticketTypeBreakdown: {
    name: string;
    price: number;
    sold: number;
    total: number;
    revenue: number;
    /** Whole percent. */
    percentSold: number;
  }[];
  revenueByProvider: { provider: PaymentProvider; amount: number; count: number }[];
  /** `channel` is `"unknown"` for transactions settled without one. */
  revenueByChannel: { channel: string; amount: number; count: number }[];
}

/**
 * On-chain reads fail per ticket type, not per call: one RPC hiccup yields
 * `{ error: "unavailable" }` on that row while the others carry figures.
 */
type OnchainRow<T> = {
  ticketTypeId: string;
  name: string;
  /** BigInt, serialized as a string. */
  onChainTicketId: string;
} & (T | { error: "unavailable" });

/** `GET /organizer/events/:id/onchain/balance` — claimable escrow. */
export interface ApiOnchainBalance {
  chain: string;
  feeType: string;
  tickets: OnchainRow<{ balanceUsdc: string; balanceRaw: string }>[];
}

/** `GET /organizer/events/:id/onchain/checkins`. */
export interface ApiOnchainCheckins {
  chain: string;
  total: number;
  tickets: OnchainRow<{ checkedIn: number }>[];
}

// ---------------------------------------------------------------------------
// Organizer — people. Three privacy tiers for the same ticket; keep them apart.
// ---------------------------------------------------------------------------

/**
 * `GET /organizer/events/:id/attendees` — the SENSITIVE tier: carries buyer
 * email and phone. Organizer surfaces only; never render this on a door.
 */
export interface ApiAttendees {
  attendees: {
    ticketReference: string;
    buyerName: string | null;
    buyerEmail: string | null;
    buyerPhone: string | null;
    ticketType: string;
    status: TicketStatus;
    checkedInAt: string | null;
    purchasedAt: string;
  }[];
  /** Event-wide, independent of the list's filters. */
  summary: {
    totalAttendees: number;
    confirmed: number;
    checkedIn: number;
    cancelled: number;
  };
  pagination: Pagination;
}

/**
 * `GET /organizer/events/:id/checkin-roster` — the DOOR tier: names only, no
 * contact details, by design. Search matches the buyer's name only.
 */
export interface ApiCheckinRoster {
  attendees: {
    ticketReference: string;
    buyerName: string | null;
    ticketType: string;
    status: TicketStatus;
    checkedInAt: string | null;
  }[];
  summary: { expected: number; checkedIn: number };
  pagination: Pagination;
}

/** `GET /organizer/users/lookup` — `email` is null for WhatsApp-only users. */
export interface ApiUserLookup {
  id: string;
  name: string;
  email: string | null;
}

/** `GET /organizer/events/:id/ticket-admins` — one row per active delegate. */
export interface ApiTicketAdmin {
  userId: string;
  name: string;
  email: string | null;
  address: string;
  status: "ACTIVE" | "REVOKED";
  grantedAt: string;
}

/**
 * `GET /organizer/my-checkin-events` — the doors this account may work.
 * This list IS the `(door)` permission check: delegates are plain BUYERs.
 */
export interface ApiCheckinEvent {
  eventId: string;
  name: string;
  slug: string;
  venue: string | null;
  location: string | null;
  startTime: string;
  endTime: string | null;
  coverImage: string | null;
  status: EventStatus;
  organizerName: string;
  grantedAt: string;
  /** True only between start and end; does not say early from late. */
  checkInOpen: boolean;
}

// ---------------------------------------------------------------------------
// Organizer — money
// ---------------------------------------------------------------------------

export type PayoutStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

/** Amounts are Decimal, serialized as strings. Currency is on the row. */
export interface ApiPayout {
  id: string;
  eventId: string;
  eventName: string;
  amount: string;
  currency: string;
  provider: PaymentProvider;
  status: PayoutStatus;
  /** The on-chain tx hash for a CRYPTO payout. */
  providerReference: string | null;
  scheduledDate: string;
  processedAt: string | null;
  createdAt: string;
}

/** `GET /organizer/payouts`. */
export interface ApiPayouts {
  payouts: ApiPayout[];
  summary: { totalPaid: string; pendingAmount: string; totalPayouts: number };
  pagination: Pagination;
}

/**
 * `GET /organizer/events/:id/beneficiaries`.
 *
 * `shareBps` is basis points of the ORGANIZER'S CUT, not of gross. Show
 * `sharePercent` (what was set) beside `grossPercent` (what reaches them).
 */
export interface ApiBeneficiaries {
  beneficiaries: {
    id: string;
    userId: string;
    name: string;
    email: string | null;
    shareBps: number;
    sharePercent: number;
    grossPercent: number;
    createdAt: string;
  }[];
  allocatedBps: number;
  remainingBps: number;
  organizerSharePercent: number;
  maxBeneficiaries: number;
}

/**
 * `GET /organizer/beneficiary-earnings` — what the viewer earned on OTHER
 * people's events. Settled money only; deliberately no gross figures.
 */
export interface ApiBeneficiaryEarnings {
  totalEarned: number;
  events: { eventId: string; name: string; slug: string; amount: number; sales: number }[];
}

// ---------------------------------------------------------------------------
// Organizer — member lists (claim-only ticket types)
// ---------------------------------------------------------------------------

/**
 * `LOCKED` = three wrong names against this matric number — a real member
 * who mistyped, or someone guessing. Only the organizer can tell which, and
 * unlocks it.
 */
export type ClaimEntryStatus = "UNCLAIMED" | "CLAIMED" | "LOCKED";

export interface ApiClaimEntry {
  id: string;
  /** Normalized server-side: trimmed, no inner spaces, uppercased. */
  matNo: string;
  fullName: string;
  status: ClaimEntryStatus;
  failedAttempts: number;
}

/**
 * `GET|POST /organizer/events/:id/ticket-types/:ticketTypeId/claim-entries`.
 * The POST (import) answers with the whole updated list.
 */
export interface ApiClaimList {
  summary: { total: number; claimed: number; locked: number; unclaimed: number };
  /** Sorted by full name. The whole list — this route does not paginate. */
  entries: ApiClaimEntry[];
}

// ---------------------------------------------------------------------------
// The door — resolve, verify, check in
// ---------------------------------------------------------------------------

/**
 * `POST /tickets/resolve-qr` — any scanned string to a ticket reference.
 * `expired` means an old signed QR: the ticket itself may be fine, so the
 * door is told to check the name, not refused.
 */
export interface ApiResolvedQr {
  reference: string;
  source: "reference" | "signed_token";
  expired: boolean;
}

interface DoorTicket {
  reference: string;
  status: TicketStatus;
  buyerName: string | null;
  ticketType: string;
  /** BigInt, as a string; null while the mint is pending. */
  tokenId: string | null;
  checkedInAt: string | null;
  message: string;
}

/**
 * `POST /tickets/:reference/verify` — read-only. An invalid ticket is a 200
 * with `valid: false` and the reason in `message` (already used, wrong
 * event, cancelled…), not an error; a 403 means this account may not work
 * this door.
 */
export type ApiDoorVerification =
  | (DoorTicket & { valid: true })
  | (DoorTicket & { valid: false });

/**
 * `POST /tickets/:reference/checkin` — marks USED and queues the on-chain
 * check-in. Unlike verify, every refusal is a 4xx.
 */
export interface ApiCheckInResult {
  reference: string;
  status: "USED";
  buyerName: string | null;
  ticketType: string;
  checkedInAt: string;
  message: string;
}

/** `GET /organizer/countries` — where an organizer can register (auth-only). */
export interface ApiOrganizerCountry {
  code: string;
  name: string;
  /** ISO-4217 — every event this organizer creates is priced in it. */
  currency: string;
  kycIdTypes: KycIdType[];
}
