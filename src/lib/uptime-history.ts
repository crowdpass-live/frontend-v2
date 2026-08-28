"use client";

import type { Level } from "./status-model";

/**
 * A 90-day sample store for the uptime strip.
 *
 * ## Read this before trusting the strip
 *
 * A statuspage.io uptime bar is drawn from an **external prober** sampling the
 * service every minute, whether or not anyone is looking. CrowdPass has no
 * prober and no server-side history, so this records what *this browser*
 * observes while the status page is open — and nothing at all while it is not.
 *
 * That makes the honesty of the rendering load-bearing:
 *
 * - A day nobody watched is **grey (no data)**, never green. Silence is not
 *   evidence of health, and colouring it green would be the whole lie.
 * - The percentage is computed over **observed days only** and is labelled as
 *   such, so it can never be read as "100% uptime over 90 days" when it means
 *   "the four days someone had the tab open looked fine".
 * - Each day keeps the **worst** level seen that day, matching how statuspage
 *   treats a partial-day incident.
 *
 * The strip becomes a real uptime record the moment the backend records
 * samples on a schedule — a `status_samples` table written by a cron, read
 * back through one endpoint. At that point this store is swapped for the fetch
 * and the component below does not change.
 */

const KEY = "crowdpass.admin.uptime";
const CHANGED = "crowdpass:uptime-changed";
const VERSION = 1;
export const WINDOW_DAYS = 90;

/** Worst-first, so a day's sample degrades but never improves. */
const SEVERITY: Record<Level, number> = {
  major: 4,
  partial: 3,
  degraded: 2,
  unknown: 1,
  operational: 0,
};

type DayMap = Record<string, Record<string, Level>>;

interface Stored {
  v: number;
  days: DayMap;
}

/** `YYYY-MM-DD` in local time — the strip is read by a human in one place. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { v: VERSION, days: {} };
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (parsed?.v !== VERSION || typeof parsed.days !== "object") {
      return { v: VERSION, days: {} };
    }
    return { v: VERSION, days: parsed.days as DayMap };
  } catch {
    return { v: VERSION, days: {} };
  }
}

/** Drops anything older than the window, so the store cannot grow forever. */
function prune(days: DayMap): DayMap {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (WINDOW_DAYS - 1));
  const oldest = dayKey(cutoff);
  const out: DayMap = {};
  for (const [k, v] of Object.entries(days)) {
    if (k >= oldest) out[k] = v;
  }
  return out;
}

/**
 * Records one observation per component for today, keeping the worst seen.
 *
 * Returns true when anything changed, so a caller can avoid a re-render on the
 * common case of "same as the last poll".
 */
export function recordSample(levels: Record<string, Level>): boolean {
  try {
    const store = read();
    const today = dayKey();
    const days = prune(store.days);
    const existing = days[today] ?? {};
    let changed = false;

    for (const [key, level] of Object.entries(levels)) {
      const prev = existing[key];
      if (prev === undefined || SEVERITY[level] > SEVERITY[prev]) {
        existing[key] = level;
        changed = true;
      }
    }

    days[today] = existing;
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, days }));
    // Wakes every subscribed strip. Fired even when the day's worst level did
    // not change, because the first poll of a new day still adds a slot.
    window.dispatchEvent(new Event(CHANGED));
    return changed;
  } catch {
    // Private mode or disabled storage. The strip then shows no data, which is
    // exactly what is true.
    return false;
  }
}

export interface StripDay {
  day: string;
  /** null means nobody was watching — rendered grey, never green. */
  level: Level | null;
}

/** Oldest → today, one slot per day, gaps included. */
export function readStrip(componentKey: string): StripDay[] {
  const { days } = read();
  const out: StripDay[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (WINDOW_DAYS - 1));

  for (let i = 0; i < WINDOW_DAYS; i++) {
    const key = dayKey(cursor);
    out.push({ day: key, level: days[key]?.[componentKey] ?? null });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export interface StripSummary {
  observedDays: number;
  /** Share of OBSERVED days that were fully operational, or null if none. */
  operationalRate: number | null;
}

export function summarise(strip: StripDay[]): StripSummary {
  const observed = strip.filter((d) => d.level !== null);
  if (observed.length === 0) {
    return { observedDays: 0, operationalRate: null };
  }
  const good = observed.filter((d) => d.level === "operational").length;
  return {
    observedDays: observed.length,
    operationalRate: good / observed.length,
  };
}

/** Wipes the local record — useful when the numbers look wrong. */
export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}


// --- store plumbing -------------------------------------------------------
//
// `useSyncExternalStore` rather than a version counter passed down as a prop:
// the strips read `localStorage`, which a server render cannot see, and the
// counter approach needed a `setState` inside an effect to signal a write.
// Subscribing removes both problems and matches how the session and the
// pending-purchase stores already work.

export function subscribeUptime(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

let cachedRaw: string | null = null;
let cachedDays: DayMap = {};

/** Stable reference for unchanged data, or React re-renders forever. */
export function getUptimeSnapshot(): DayMap {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedDays = read().days;
  }
  return cachedDays;
}

/** The server has no storage, so there is never any history during SSR. */
export function getUptimeServerSnapshot(): DayMap {
  return EMPTY_DAYS;
}

const EMPTY_DAYS: DayMap = {};

/** Builds a strip from an already-read snapshot, so the caller controls I/O. */
export function stripFrom(days: DayMap, componentKey: string): StripDay[] {
  const out: StripDay[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (WINDOW_DAYS - 1));
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const key = dayKey(cursor);
    out.push({ day: key, level: days[key]?.[componentKey] ?? null });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
