import type { ApiEvent, ApiTicketType, EventCategory } from "@/types/api";

/**
 * The create/edit event form (#38), as plain data: defaults, the backend's
 * rules as client-side checks, and the request body. Kept apart from the
 * component so the rules are in one readable place.
 *
 * Every limit here is `CreateEventDto`'s, or `EventsService.create`'s — the
 * API runs with `forbidNonWhitelisted` and 400s the WHOLE request on one
 * miss, so a host should never meet a limit only after pressing save.
 */

export const LIMITS = {
  name: 100,
  description: 1000,
  venue: 200,
  location: 120,
  tiers: 5,
  tierName: 60,
  price: 500_000,
  /** Paid tickets: the backend refuses anything between ₦0 and ₦500. */
  minPaidPrice: 500,
  quantity: 50_000,
  maxPerUser: 10,
} as const;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const CATEGORIES: { value: EventCategory; label: string }[] = [
  { value: "PARTY", label: "Party" },
  { value: "CONCERT", label: "Concert" },
  { value: "CONFERENCE", label: "Conference" },
  { value: "WORKSHOP", label: "Workshop" },
  { value: "CORPORATE", label: "Corporate" },
  { value: "SPORTS", label: "Sports" },
  { value: "OTHER", label: "Other" },
];

export interface TierDraft {
  /** Set for a tier that already exists (edit) — the API upserts by id. */
  id?: string;
  /** Stable React key for new rows. */
  key: string;
  name: string;
  price: string;
  quantity: string;
  maxPerUser: string;
  /** Read-only: a tier with sales can't be removed (the API refuses). */
  soldCount?: number;
  claimOnly?: boolean;
}

export interface EventDraft {
  name: string;
  description: string;
  category: EventCategory;
  venue: string;
  location: string;
  coverImage: string | null;
  /**
   * ISO-8601 UTC, never the input's local wall-clock string. The initial
   * draft is built on the SERVER, whose zone (UTC on Vercel) isn't the
   * host's: converting there would shift a Lagos event an hour on every
   * edit. Only the browser converts, via DateTimeField's value.
   */
  start: string;
  end: string;
  isRefundable: boolean;
  chain: string | null;
  tiers: TierDraft[];
  /** Edit only: preserved as-is (it must stay ≤ start − 1 day). */
  purchaseStartTime?: string | null;
}

/**
 * Random, not a counter: the first rows are made on the server (the page
 * builds the initial draft) and later ones in the browser, where a counter
 * would start again and hand a new row the key of an existing one.
 */
const rowKey = () => `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const newTier = (over: Partial<TierDraft> = {}): TierDraft => ({
  key: rowKey(),
  name: "",
  price: "",
  quantity: "",
  maxPerUser: "",
  ...over,
});

/**
 * Next week at 8pm, ending the next day at 9pm — valid out of the box.
 * "8pm" is the HOST's 8pm, so this runs in the browser (EventForm fills an
 * empty start after hydration); on the server the dates stay empty.
 */
export function defaultTimes(now = Date.now()): { start: string; end: string } {
  const start = new Date(now + 7 * DAY);
  start.setHours(20, 0, 0, 0);
  return { start: start.toISOString(), end: new Date(start.getTime() + DAY + HOUR).toISOString() };
}

export function defaultDraft(defaultChain: string | null): EventDraft {
  return {
    name: "",
    description: "",
    category: "PARTY",
    venue: "",
    location: "",
    coverImage: null,
    start: "",
    end: "",
    isRefundable: false,
    chain: defaultChain,
    tiers: [newTier({ name: "General", price: "5000", quantity: "100" })],
  };
}

/** A draft from `GET /events/me/drafts`, for the edit form. */
export function draftFromEvent(e: ApiEvent & { ticketTypes: ApiTicketType[] }): EventDraft {
  return {
    name: e.name ?? "",
    description: e.description ?? "",
    category: e.category ?? "OTHER",
    venue: e.venue ?? "",
    location: e.location ?? "",
    coverImage: e.coverImage ?? null,
    start: e.startTime ?? "",
    end: e.endTime ?? "",
    isRefundable: !!e.isRefundable,
    chain: e.chain ?? null,
    purchaseStartTime: e.purchaseStartTime,
    tiers: e.ticketTypes.map((t) =>
      newTier({
        id: t.id,
        name: t.name,
        price: String(Number(t.price)),
        quantity: String(t.quantity),
        maxPerUser: t.maxPerUser ? String(t.maxPerUser) : "",
        soldCount: t.soldCount,
        claimOnly: t.claimOnly,
      }),
    ),
  };
}

/** If the start moves, keep the end at least a day after it (as mobile does). */
export function endAfterStart(start: string, end: string): string {
  if (!start) return end;
  const min = new Date(start).getTime() + DAY;
  if (end && new Date(end).getTime() >= min) return end;
  return new Date(min + HOUR).toISOString();
}

/** The earliest allowed start (ISO), for the input's `min`. */
export function earliestStart(now = Date.now()): string {
  return new Date(now + DAY + HOUR).toISOString();
}

export type TierErrors = Partial<Record<"name" | "price" | "quantity" | "maxPerUser", string>>;
export interface DraftErrors {
  name?: string;
  description?: string;
  venue?: string;
  location?: string;
  start?: string;
  end?: string;
  tiers?: string;
  tier: Record<string, TierErrors>;
}

const isInt = (v: string) => /^\d+$/.test(v.trim());
const isMoney = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim());

/** Every rule the API would enforce. Empty `tier` map + no keys = valid. */
export function validate(d: EventDraft, now = Date.now()): DraftErrors {
  const errors: DraftErrors = { tier: {} };
  const len = (s: string) => s.trim().length;

  if (!len(d.name)) errors.name = "Give the event a name";
  else if (len(d.name) > LIMITS.name) errors.name = `At most ${LIMITS.name} characters`;
  if (!len(d.description)) errors.description = "Say what the event is — buyers read this first";
  else if (len(d.description) > LIMITS.description) errors.description = `At most ${LIMITS.description} characters`;
  if (!len(d.venue)) errors.venue = "Where is it? e.g. Muri Okunola Park";
  else if (len(d.venue) > LIMITS.venue) errors.venue = `At most ${LIMITS.venue} characters`;
  if (!len(d.location)) errors.location = "Which city? e.g. Lagos";
  else if (len(d.location) > LIMITS.location) errors.location = `At most ${LIMITS.location} characters`;

  const start = d.start || null;
  const end = d.end || null;
  if (!start) errors.start = "Pick a start date and time";
  else if (new Date(start).getTime() <= now + DAY) errors.start = "Must be more than 24 hours from now";
  if (!end) errors.end = "Pick an end date and time";
  else if (start && new Date(end).getTime() < new Date(start).getTime() + DAY) {
    errors.end = "Must be at least a day after the start";
  }

  if (d.tiers.length < 1) errors.tiers = "Add at least one ticket type";
  if (d.tiers.length > LIMITS.tiers) errors.tiers = `At most ${LIMITS.tiers} ticket types`;
  const names = new Set<string>();
  for (const t of d.tiers) {
    const e: TierErrors = {};
    const name = t.name.trim();
    if (!name) e.name = "Name it, e.g. Regular or VIP";
    else if (name.length > LIMITS.tierName) e.name = `At most ${LIMITS.tierName} characters`;
    else if (names.has(name.toLowerCase())) e.name = "Two ticket types can't share a name";
    names.add(name.toLowerCase());

    if (!isMoney(t.price)) e.price = "A price in naira — 0 for free";
    else {
      const p = Number(t.price);
      if (p > LIMITS.price) e.price = `At most ₦${LIMITS.price.toLocaleString("en-NG")}`;
      else if (p > 0 && p < LIMITS.minPaidPrice) e.price = `Paid tickets start at ₦${LIMITS.minPaidPrice}`;
    }
    if (!isInt(t.quantity) || Number(t.quantity) < 1) e.quantity = "How many? At least 1";
    else if (Number(t.quantity) > LIMITS.quantity) e.quantity = `At most ${LIMITS.quantity.toLocaleString("en-NG")}`;
    else if (t.soldCount && Number(t.quantity) < t.soldCount) e.quantity = `${t.soldCount} already sold`;
    if (t.maxPerUser.trim()) {
      if (!isInt(t.maxPerUser) || Number(t.maxPerUser) < 1 || Number(t.maxPerUser) > LIMITS.maxPerUser) {
        e.maxPerUser = `1 to ${LIMITS.maxPerUser}, or leave blank for 5`;
      }
    }
    if (Object.keys(e).length) errors.tier[t.key] = e;
  }
  return errors;
}

export function hasErrors(e: DraftErrors): boolean {
  return Object.keys(e).some((k) => k !== "tier" && e[k as keyof DraftErrors]) || Object.keys(e.tier).length > 0;
}

/**
 * The request body. Optional fields are OMITTED rather than sent empty —
 * `forbidNonWhitelisted` aside, `""` fails `@IsUrl()` and `@IsDateString()`.
 * `chain` goes on create only: it is immutable, and the update DTO has no
 * such field, so sending it 400s.
 */
export function toPayload(d: EventDraft, mode: "create" | "edit") {
  const prices = d.tiers.map((t) => Number(t.price));
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    venue: d.venue.trim(),
    location: d.location.trim(),
    category: d.category,
    // Create: omit when there's none. Edit: null REMOVES the cover — the
    // service applies any coverImage that isn't undefined.
    ...(d.coverImage ? { coverImage: d.coverImage } : mode === "edit" ? { coverImage: null } : {}),
    startTime: d.start,
    endTime: d.end,
    // Sales open now on create (as on mobile); an edit keeps what it had.
    purchaseStartTime:
      mode === "edit" && d.purchaseStartTime ? d.purchaseStartTime : new Date().toISOString(),
    // The backend demands every price be 0 when isFree, and ≥500 otherwise.
    isFree: prices.every((p) => p === 0),
    isRefundable: d.isRefundable,
    ...(mode === "create" && d.chain ? { chain: d.chain } : {}),
    ticketTypes: d.tiers.map((t) => ({
      ...(mode === "edit" && t.id ? { id: t.id } : {}),
      name: t.name.trim(),
      price: Number(t.price),
      quantity: Number(t.quantity),
      ...(t.maxPerUser.trim() ? { maxPerUser: Number(t.maxPerUser) } : {}),
    })),
  };
}
