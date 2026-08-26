"use client";

import { useSyncExternalStore } from "react";

/** Never fires — the value flips once, when React hydrates. */
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` during the server render and the hydrating render, `true` after.
 *
 * Used to hold a loading state until client-only data (`localStorage`) has
 * actually been read, instead of rendering an "it isn't there" state on the
 * server and correcting it a frame later.
 *
 * Written with `useSyncExternalStore` rather than the usual
 * `useState(false)` + `useEffect(() => setHydrated(true))`: it produces the
 * same result without a state update during an effect, so it can't schedule a
 * cascading render.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
