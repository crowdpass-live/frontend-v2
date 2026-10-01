"use client";

import { ApiError } from "./api";
import type { SessionUser } from "./normalize";

/**
 * Browser side of the session: sign in, sign out, and hear about either
 * happening in another tab.
 *
 * The cookie is httpOnly, so no tab can observe it changing — a sign-out in
 * one tab would otherwise leave every other tab rendering a dashboard whose
 * next request 401s. Each change is announced on a `BroadcastChannel`
 * instead, which reaches the app's other tabs and nothing else.
 */

export type SessionChange = "signed-in" | "signed-out";

const CHANNEL = "crowdpass:session";

function announce(change: SessionChange) {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(change);
    channel.close();
  } catch {
    // No BroadcastChannel (very old Safari): other tabs find out on their
    // next request, through the 401 path. Survivable.
  }
}

/** Calls `onChange` when ANOTHER tab signs in or out. Returns unsubscribe. */
export function subscribeSession(
  onChange: (change: SessionChange) => void,
): () => void {
  let channel: BroadcastChannel;
  try {
    channel = new BroadcastChannel(CHANNEL);
  } catch {
    return () => {};
  }
  channel.onmessage = (e) => {
    if (e.data === "signed-in" || e.data === "signed-out") onChange(e.data);
  };
  return () => channel.close();
}

export interface SignInInput {
  email?: string;
  phone?: string;
  password: string;
}

/**
 * `POST /api/session`. Resolves with the user; rejects with an `ApiError`
 * carrying the backend's status — 401 is bad credentials, 403 is an
 * unverified email (never tell that user their password is wrong).
 */
export function signIn(input: SignInInput): Promise<SessionUser> {
  return startSession("/api/session", input, "Could not sign in. Please try again.");
}

/**
 * `POST /api/session/verify-email` — a correct code signs the new account
 * in (the server sets the cookie). Rejects with the backend's 400 for a
 * wrong or expired code.
 */
export function verifyEmail(email: string, code: string): Promise<SessionUser> {
  return startSession("/api/session/verify-email", { email, code }, "Could not verify that code. Please try again.");
}

/** Both session-starting routes: same request, same error shape. */
async function startSession(path: string, body: unknown, fallback: string): Promise<SessionUser> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiError(
      0,
      "Could not reach CrowdPass. Please check your connection and try again.",
      err,
    );
  }

  const data = (await res.json().catch(() => null)) as
    | { user?: SessionUser; message?: string; errors?: string[] }
    | null;

  if (!res.ok || !data?.user) {
    const message = data?.errors?.join(", ") || data?.message || fallback;
    throw new ApiError(res.status, message, data);
  }

  announce("signed-in");
  return data.user;
}

/**
 * `DELETE /api/session`. Purely local — the backend has no logout, so the
 * JWT stays valid until it expires; we just drop our only copy of it.
 */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/session", { method: "DELETE" });
  } finally {
    announce("signed-out");
  }
}
