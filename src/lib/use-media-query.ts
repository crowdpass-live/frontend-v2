"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, live. `false` on the server and during
 * hydration, so the first paint is always the phone layout — the safe one —
 * and a wide screen switches a frame later.
 *
 * For layouts that differ in WHAT is mounted, not just how it's styled (a
 * panel that fetches its own data shouldn't be rendered twice and hidden
 * once). Pure styling belongs in Tailwind breakpoints instead.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind's `lg`. */
export const WIDE = "(min-width: 1024px)";
