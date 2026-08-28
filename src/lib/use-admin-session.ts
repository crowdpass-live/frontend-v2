"use client";

import { useSyncExternalStore } from "react";
import {
  getSessionServerSnapshot,
  getSessionSnapshot,
  subscribeSession,
  type AdminSession,
} from "./admin-auth";

/**
 * The current admin session, or null.
 *
 * `useSyncExternalStore` rather than an effect + setState: the session lives
 * in `localStorage`, which a server render cannot see, and reading it in an
 * effect would flash the signed-out state for one frame on every admin page
 * load. The server snapshot is null and the subscription covers a sign-out in
 * this tab or another one.
 */
export function useAdminSession(): AdminSession | null {
  return useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getSessionServerSnapshot,
  );
}
