import type { Rate } from "@/types/admin";

/**
 * Formatting for the admin surface.
 *
 * The one rule that runs through all of it: **a rate is `null`, never `0`,
 * when there was nothing to divide.** `0%` is a measurement — it says the
 * business earns nothing, that nobody turned up, that no notification
 * succeeded. `null` says there was nothing to measure. Rendering the second as
 * the first turns a quiet week into a crisis on the dashboard, so nulls render
 * as an em dash with a reason beside them and never as a number.
 */

/** The placeholder for "there was nothing to measure". */
export const NO_VALUE = "—";

/** NGN, 2dp, grouped. `1234567.5` -> `"₦1,234,567.50"`. */
export function ngn(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return NO_VALUE;
  }
  return `₦${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Compact NGN for tiles where the exact kobo is noise: `₦2.9M`, `₦847.2K`.
 * The precise figure belongs in a title attribute, not in 40px type.
 */
export function ngnCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return NO_VALUE;
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `₦${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `₦${(value / 1_000).toFixed(1)}K`;
  return ngn(value);
}

/**
 * `0.0312` -> `"3.12%"`. Null stays null — callers pair it with a reason.
 *
 * Takes the API's 0–1 form directly, so nothing has to remember to multiply.
 */
export function percent(rate: Rate, digits = 2): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) {
    return NO_VALUE;
  }
  return `${(rate * 100).toFixed(digits)}%`;
}

/** `12345` -> `"12,345"`. */
export function count(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return NO_VALUE;
  }
  return value.toLocaleString("en-US");
}

/** `"PAYSTACK"` -> `"Paystack"`, for provider and status labels. */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * `"2026-08-27"` -> `"27 Aug"`. Chart axis labels.
 *
 * Parsed as UTC noon rather than midnight: the API buckets by
 * `date_trunc('day', …)` in the database's zone, and a midnight parse can slip
 * a day backwards once rendered west of UTC.
 */
export function shortDay(isoDay: string): string {
  const d = new Date(`${isoDay}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDay;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** `"27 Aug 2026, 14:32"` — for `generatedAt` stamps. */
export function stamp(iso: string | null | undefined): string {
  if (!iso) return NO_VALUE;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NO_VALUE;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** `"3 minutes ago"`, for a polled snapshot's age. */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return NO_VALUE;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return NO_VALUE;
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} day(s) ago`;
}

/** ISO date range for the last `days` days, `to` exclusive as the API expects. */
export function lastDays(days: number): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}
