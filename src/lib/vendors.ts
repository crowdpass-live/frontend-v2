import type {
  ApiStallType,
  VendorApplicationStatus,
  VendorPaymentStatus,
} from "@/types/api";

/**
 * Vendor registration (#42–#46), shared by the organizer's setup and review
 * pages and the vendor's own. Browser- and server-safe.
 */

export function organizerVendorsPath(eventId: string, rest = ""): string {
  return `/organizer/events/${encodeURIComponent(eventId)}${rest}`;
}

type Tone = "ok" | "warn" | "info" | "danger" | "neutral";

export const APPLICATION_STATUS: Record<VendorApplicationStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warn" },
  APPROVED: { label: "Approved", tone: "ok" },
  REJECTED: { label: "Rejected", tone: "danger" },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

export const PAYMENT_STATUS: Record<VendorPaymentStatus, { label: string; tone: Tone }> = {
  UNPAID: { label: "Unpaid", tone: "neutral" },
  PAID: { label: "Paid", tone: "ok" },
};

/** `CreateStallTypeDto` limits, and the 1–499 gap the service enforces. */
export const STALL_LIMITS = {
  name: 100,
  description: 1000,
  minPaidPrice: 500,
  maxPrice: 500_000,
  maxQuantity: 10_000,
  maxPasses: 20,
  defaultPasses: 2,
} as const;

/** Form state: strings, as typed. */
export interface StallDraft {
  name: string;
  description: string;
  price: string;
  quantity: string;
  passesPerStall: string;
}

export type StallErrors = Partial<Record<keyof StallDraft, string>>;

export function emptyStallDraft(): StallDraft {
  return { name: "", description: "", price: "", quantity: "", passesPerStall: String(STALL_LIMITS.defaultPasses) };
}

export function stallDraftFrom(s: ApiStallType): StallDraft {
  return {
    name: s.name,
    description: s.description ?? "",
    price: String(s.price),
    quantity: String(s.quantity),
    passesPerStall: String(s.passesPerStall),
  };
}

const isInt = (v: string) => /^\d+$/.test(v.trim());
/** Naira with at most two decimals (`@IsNumber({ maxDecimalPlaces: 2 })`). */
const isMoney = (v: string) => /^\d+(\.\d{1,2})?$/.test(v.trim());

/** `allocated` is the stalls already promised; quantity can't drop below it. */
export function validateStall(d: StallDraft, allocated = 0): StallErrors {
  const e: StallErrors = {};
  const name = d.name.trim();
  if (!name) e.name = "Name it, e.g. Food stall 3×3m";
  else if (name.length > STALL_LIMITS.name) e.name = `At most ${STALL_LIMITS.name} characters`;
  if (d.description.trim().length > STALL_LIMITS.description) {
    e.description = `At most ${STALL_LIMITS.description.toLocaleString("en-NG")} characters`;
  }

  if (!isMoney(d.price)) e.price = "A fee in naira — 0 for a free stall";
  else {
    const p = Number(d.price);
    if (p > STALL_LIMITS.maxPrice) e.price = `At most ₦${STALL_LIMITS.maxPrice.toLocaleString("en-NG")}`;
    else if (p > 0 && p < STALL_LIMITS.minPaidPrice) e.price = `Paid stalls start at ₦${STALL_LIMITS.minPaidPrice}`;
  }

  if (!isInt(d.quantity) || Number(d.quantity) < 1) e.quantity = "How many stalls? At least 1";
  else if (Number(d.quantity) > STALL_LIMITS.maxQuantity) {
    e.quantity = `At most ${STALL_LIMITS.maxQuantity.toLocaleString("en-NG")}`;
  } else if (Number(d.quantity) < allocated) {
    e.quantity = `${allocated} already promised to approved vendors`;
  }

  if (!isInt(d.passesPerStall) || Number(d.passesPerStall) < 1 || Number(d.passesPerStall) > STALL_LIMITS.maxPasses) {
    e.passesPerStall = `1 to ${STALL_LIMITS.maxPasses}`;
  }
  return e;
}

/** The create body. Description is omitted when empty, never sent as "". */
export function stallCreateBody(d: StallDraft) {
  const description = d.description.trim();
  return {
    name: d.name.trim(),
    ...(description ? { description } : {}),
    price: Number(d.price),
    quantity: Number(d.quantity),
    passesPerStall: Number(d.passesPerStall),
  };
}

/**
 * The PATCH body: only what changed. An emptied description IS sent, as "" —
 * the service stores that as null, which is the only way to clear it.
 */
export function stallUpdateBody(d: StallDraft, was: ApiStallType) {
  const body: Record<string, string | number> = {};
  const name = d.name.trim();
  const description = d.description.trim();
  if (name !== was.name) body.name = name;
  if (description !== (was.description ?? "")) body.description = description;
  if (Number(d.price) !== was.price) body.price = Number(d.price);
  if (Number(d.quantity) !== was.quantity) body.quantity = Number(d.quantity);
  if (Number(d.passesPerStall) !== was.passesPerStall) body.passesPerStall = Number(d.passesPerStall);
  return body;
}
