"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cx, Spinner } from "./ui";
import type { EventCategory } from "@/types/api";

/**
 * The real backend `EventCategory` enum, not the design's chip row.
 *
 * `10-discover-home.png` shows "All · Party · Concert · Weddings", but
 * "Weddings" is not a category the API accepts — filtering by it would return
 * an empty list forever. This is open issue #6 in the design doc (three
 * competing taxonomies); the enum wins until the design is reconciled.
 */
const CATEGORIES: { label: string; value: EventCategory }[] = [
  { label: "Party", value: "PARTY" },
  { label: "Concert", value: "CONCERT" },
  { label: "Conference", value: "CONFERENCE" },
  { label: "Workshop", value: "WORKSHOP" },
  { label: "Corporate", value: "CORPORATE" },
  { label: "Sports", value: "SPORTS" },
  { label: "Other", value: "OTHER" },
];

/** Debounce so a search doesn't fire a request per keystroke on 4G. */
const SEARCH_DEBOUNCE_MS = 350;

function SearchIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function DiscoverFilters({
  locations,
}: {
  /** Distinct locations present in the current results. */
  locations: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeCategory = params.get("category");
  const activeLocation = params.get("location") ?? "";
  const urlSearch = params.get("search") ?? "";

  // The input is uncontrolled-ish: it holds what the user typed, and syncs
  // back only when the URL changes from somewhere else (back button, a chip).
  const [search, setSearch] = useState(urlSearch);
  const lastPushed = useRef(urlSearch);
  useEffect(() => {
    if (urlSearch !== lastPushed.current) {
      lastPushed.current = urlSearch;
      setSearch(urlSearch);
    }
  }, [urlSearch]);

  /**
   * Filters live in the URL, not in component state, so a filtered view is
   * shareable and survives the back button — and so the server component can
   * do the fetching.
   */
  const apply = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any filter change invalidates the page cursor.
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  // Debounced search push.
  useEffect(() => {
    if (search === lastPushed.current) return;
    const t = setTimeout(() => {
      lastPushed.current = search;
      apply({ search: search.trim() || null });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // `apply` closes over `params`, which changes on every push; re-running on
    // it would re-fire the search. The timer only ever needs the latest text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    // Stacked on a phone; search and location share a row from `lg` up, where
    // three full-width stacked controls would be a column of empty space.
    <div className="flex flex-col gap-5">
      {/* `display: contents` on small screens, so search and location become
       * direct children of the column above and `order` can interleave them
       * with the chips. On a phone the sequence is search → chips → location:
       * search is what people reach for, the chips are one tap, and location
       * is the least-used control. From `lg` this collapses back into a real
       * row holding search and location side by side. */}
      <div className="contents lg:flex lg:items-center lg:gap-4">
      <div className="relative order-1 lg:order-none lg:max-w-xl lg:flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-text-faint">
          <SearchIcon />
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events, venues, locations"
          aria-label="Search events"
          className="h-14 w-full rounded-control border border-border bg-surface pl-12 pr-12 text-body text-text placeholder:text-text-faint"
        />
        {isPending ? (
          <span className="absolute inset-y-0 right-4 grid place-items-center text-text-faint">
            <Spinner />
          </span>
        ) : null}
      </div>

      {/* Only rendered when the data actually offers a choice. The options are
       * built from the locations present in the results rather than a
       * hardcoded city list, because `location` is free text on the event
       * ("Lagos, NG", "Kaduna, Nigeria", "Nigeria") — a fixed list would offer
       * cities that match nothing. */}
      {locations.length > 1 ? (
        <label className="order-3 flex items-center gap-3 text-label text-text-dim lg:order-none lg:shrink-0">
          <span className="shrink-0">Location</span>
          <select
            value={activeLocation}
            onChange={(e) => apply({ location: e.target.value || null })}
            className="h-11 min-w-0 flex-1 rounded-control border border-border bg-surface px-3 text-label text-text lg:h-14 lg:w-56 lg:flex-none"
          >
            <option value="">Anywhere</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      </div>

      {/* Horizontally scrollable so seven categories don't wrap into a wall on
       * a 320px phone; wraps normally once there is room. The scroller clips
       * itself, never the page. */}
      <div className="order-2 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:overflow-visible sm:px-0 lg:order-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          <Chip
            active={!activeCategory}
            onClick={() => apply({ category: null })}
          >
            All
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              active={activeCategory === c.value}
              onClick={() =>
                apply({ category: activeCategory === c.value ? null : c.value })
              }
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "h-10 shrink-0 rounded-full px-4 text-label font-medium transition-colors",
        active
          ? "bg-accent text-ink"
          : "bg-surface text-text-dim hover:bg-surface-strong hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
