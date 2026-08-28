"use client";

import type { AuthUser } from "@/types/admin";

/**
 * Admin session, held in `localStorage`.
 *
 * The token has to be readable by client JavaScript because the browser talks
 * to the API directly — there is no BFF here to hold an httpOnly cookie and
 * proxy on its behalf. That is a real trade-off, so be clear about what it
 * does and does not protect:
 *
 * **The client-side role check is a courtesy, not a gate.** Anyone can put
 * `role: "ADMIN"` in localStorage and see the dashboard shell. They will see
 * nothing in it: every `/admin/*` route is `@Roles(UserRole.ADMIN)` server-
 * side and answers 403 to anything else, so the panels come back empty. The
 * check exists to stop an ORGANIZER who logs in here from staring at a wall of
 * failed requests, not to keep anyone out.
 *
 * If this ever needs to be a real boundary — an admin action that mutates, say
 * — it should move behind a route handler with an httpOnly cookie rather than
 * being hardened in place.
 */

const KEY = "crowdpass.admin.session";

export interface AdminSession {
  accessToken: string;
  user: AuthUser;
}

export function readSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminSession>;
    if (!parsed?.accessToken || !parsed.user?.id) return null;
    return parsed as AdminSession;
  } catch {
    return null;
  }
}

export function writeSession(session: AdminSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
    notify();
  } catch {
    // Private mode or disabled site data. The session then lasts exactly as
    // long as the tab, which is survivable for an internal tool.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
    notify();
  } catch {
    // Nothing to do.
  }
}

/** The token, or null. Read at call time so a sign-out takes effect at once. */
export function authHeader(): Record<string, string> {
  const s = readSession();
  return s ? { Authorization: `Bearer ${s.accessToken}` } : {};
}

// --- store plumbing, so a sign-out in one tab updates the others -----------

const CHANGED = "crowdpass:admin-session-changed";

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED));
}

let cachedRaw: string | null = null;
let cachedValue: AdminSession | null = null;

export function subscribeSession(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Stable reference for unchanged data, or React re-renders forever. */
export function getSessionSnapshot(): AdminSession | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = readSession();
  }
  return cachedValue;
}

/** The server has no storage, so there is never a session during SSR. */
export function getSessionServerSnapshot(): AdminSession | null {
  return null;
}
