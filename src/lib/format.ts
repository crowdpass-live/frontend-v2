/**
 * Formatting helpers shared by the event, checkout and ticket pages.
 *
 * All of these are deterministic given their input — no `Date.now()`, no
 * locale sniffing — because they run during server render and again during
 * hydration, and a mismatch between the two is a React hydration error on
 * the buyer's first paint.
 */

/**
 * `50000` -> `"₦50,000"`. Prices arrive from Prisma `Decimal` columns as
 * strings, so accept both and coerce once, here.
 */
export function money(
  amount: string | number | null | undefined,
  currency = "NGN",
): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "Free";
  if (currency === "NGN") return `₦${n.toLocaleString(LOCALE)}`;
  return `${n.toLocaleString(LOCALE)} ${currency}`;
}

/**
 * Africa/Lagos, always.
 *
 * The event is in Lagos and the buyer is almost always in Lagos, but a buyer
 * on a VPN or travelling would otherwise see the door time shifted into their
 * own zone — and "10:00 PM" quietly becoming "9:00 PM" is the kind of bug that
 * makes someone miss an event. Pinning the zone also keeps server and client
 * renders identical.
 */
const TZ = "Africa/Lagos";

/**
 * `en-US`, not `en-NG`. The design and the mobile app both render
 * "Sat, Jun 28" and "10:00 PM"; `en-NG` produces day-first "28 Jun" and a
 * 24-hour clock, which would put web and mobile visibly out of step on the
 * same ticket. Only the calendar formatting is US — the currency stays NGN
 * and the timezone stays Lagos.
 */
const LOCALE = "en-US";

/** `"Sat, Jun 28"` */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Date TBA";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date TBA";
  return d.toLocaleDateString(LOCALE, {
    timeZone: TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** `"10:00 PM"` */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(LOCALE, {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** `"Saturday, June 28, 2026 at 10:00 PM"` — the long form for the ticket. */
export function formatDateTimeLong(iso: string | null | undefined): string {
  if (!iso) return "Date to be announced";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date to be announced";
  return `${d.toLocaleDateString(LOCALE, {
    timeZone: TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })} at ${formatTime(iso)}`;
}

/** `"PARTY"` -> `"Party"` */
export function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** `"BASE-SEPOLIA"` -> `"Base Sepolia"` */
export function chainName(chain: string | null | undefined): string {
  if (!chain) return "";
  return chain
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Nigerian numbers as typed locally (`08012345678`) into the E.164 the
 * backend DTO requires (`+2348012345678`). Returns null for anything that
 * isn't recognisably a phone number — the field is optional, and sending a
 * malformed value fails the whole purchase on a `@Matches` constraint, so a
 * null is dropped from the payload rather than passed through.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.replace(/[\s()-]/g, "");
  if (!trimmed) return null;

  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;
  // 08012345678 -> +2348012345678
  if (/^0\d{10}$/.test(trimmed)) return `+234${trimmed.slice(1)}`;
  // 2348012345678 -> +2348012345678
  if (/^234\d{10}$/.test(trimmed)) return `+${trimmed}`;
  // 8012345678 -> +2348012345678
  if (/^[789]\d{9}$/.test(trimmed)) return `+234${trimmed}`;
  return null;
}

/**
 * Whether an event can be bought right now, and why not if it can't.
 *
 * Shared by the event page and the checkout page so the two can never
 * disagree — a "Get tickets" button that leads to "sales have closed" is
 * worse than no button. Kept as a plain function taking `now` rather than
 * reading the clock inside a component, so it is pure and testable.
 */
export interface SaleWindow {
  canBuy: boolean;
  /** Why not, phrased for the buyer. Null when `canBuy`. */
  reason: string | null;
}

export function saleWindow(
  event: {
    startTime: string;
    purchaseStartTime: string | null;
    ticketTypes: { available: number; isOnSale: boolean }[];
  },
  now: number = Date.now(),
): SaleWindow {
  const tiers = event.ticketTypes ?? [];

  if (now >= new Date(event.startTime).getTime()) {
    return { canBuy: false, reason: "Sales have closed" };
  }
  if (
    event.purchaseStartTime &&
    now < new Date(event.purchaseStartTime).getTime()
  ) {
    return {
      canBuy: false,
      reason: `Sales open ${formatDate(event.purchaseStartTime)}`,
    };
  }
  if (tiers.length === 0) {
    return { canBuy: false, reason: "No tickets published" };
  }
  if (tiers.every((t) => t.available <= 0)) {
    return { canBuy: false, reason: "Sold out" };
  }
  if (!tiers.some((t) => t.isOnSale)) {
    return { canBuy: false, reason: "Not on sale" };
  }
  return { canBuy: true, reason: null };
}
