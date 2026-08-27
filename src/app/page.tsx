import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { fetchUpcomingEvents } from "@/lib/crowdpass";
import { DiscoverFilters } from "@/components/DiscoverFilters";
import { EventCard, FeaturedEventCard } from "@/components/EventCards";
import { Card, SectionTitle, Container } from "@/components/ui";
import { EventCardSkeleton, Skeleton } from "@/components/Skeleton";
import { Mascot } from "@/components/Mascot";
import type { ApiEventListItem, EventCategory } from "@/types/api";

export const metadata: Metadata = {
  title: "CrowdPass — Find your next night out",
  description:
    "Discover parties, concerts and conferences across Nigeria, and get your ticket in under a minute. No account needed.",
};

/** How many events one page of Discover shows. */
const PAGE_SIZE = 12;

const CATEGORY_VALUES = new Set<string>([
  "CONCERT",
  "CONFERENCE",
  "WORKSHOP",
  "PARTY",
  "CORPORATE",
  "SPORTS",
  "OTHER",
]);

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | undefined =>
  (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

export default function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <main className="flex flex-1 flex-col pb-16">
      <Container size="page" className="flex flex-col gap-8 pt-8 lg:gap-12 lg:pt-16">
        <header className="flex flex-col gap-6 lg:gap-8">
          {/* The headline is the page's one piece of voice, so it gets to grow
           * a long way — but capped, because a line of display type running
           * the full 1152px is a banner, not a headline. */}
          <h1 className="max-w-3xl text-display font-bold leading-tight tracking-tight text-text text-balance lg:text-6xl">
            Find your <span className="text-accent">next night</span> out
          </h1>
          {/* Suspense boundary: DiscoverFilters reads useSearchParams, and
           * without one that would opt the whole page out of static shell
           * rendering. */}
          <Suspense fallback={<Skeleton className="h-14 w-full rounded-control" />}>
            <FiltersSlot />
          </Suspense>
        </header>

        <Suspense fallback={<LoadingResults />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </Container>
    </main>
  );
}

/**
 * Takes no search params: the filter controls read the URL themselves on the
 * client. This only supplies the location options, which come from the
 * *unfiltered* upcoming set — sourcing them from the current results would
 * mean picking "Lagos" leaves Lagos as the only option, stranding the buyer
 * with no way back to the others.
 */
async function FiltersSlot() {
  const all = await fetchUpcomingEvents({ limit: 50 }).catch(() => null);
  const locations = [
    ...new Set(
      (all?.events ?? [])
        .map((e) => e.location)
        .filter((l): l is string => !!l),
    ),
  ].sort();

  return <DiscoverFilters locations={locations} />;
}

async function Results({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const rawCategory = one(params.category);
  const page = Math.max(1, Number(one(params.page) ?? 1) || 1);

  const query = {
    page,
    limit: PAGE_SIZE,
    search: one(params.search),
    // Never forward an unrecognised category — the backend 400s on an enum
    // miss, which would turn a hand-edited URL into a broken page.
    category:
      rawCategory && CATEGORY_VALUES.has(rawCategory)
        ? (rawCategory as EventCategory)
        : undefined,
    location: one(params.location),
  };

  let events: ApiEventListItem[];
  let totalPages: number;
  try {
    const result = await fetchUpcomingEvents(query);
    events = result.events;
    totalPages = result.pagination.totalPages;
  } catch {
    return (
      <Card className="p-6 text-body text-text-dim">
        We couldn&apos;t load events just now. Refresh the page to try again.
      </Card>
    );
  }

  if (events.length === 0) {
    const filtered = !!(query.search || query.category || query.location);
    return (
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <Mascot pose="no-tickets" height={120} />
        <p className="max-w-sm text-body text-text-dim">
          {filtered
            ? "No upcoming events match that. Try a different search or clear the filters."
            : "There are no upcoming events right now. Check back soon."}
        </p>
        {filtered ? (
          <Link
            href="/"
            className="text-body font-bold text-accent hover:text-accent-hi"
          >
            Clear filters
          </Link>
        ) : null}
      </Card>
    );
  }

  // The soonest event leads; the rest fall into the list. Not on page 2+
  // (nothing there is "featured"), and not while searching — the top hit is a
  // result, and dressing it up as a recommendation misreads the intent.
  const showFeatured = page === 1 && !query.search;
  const featured = showFeatured ? events[0] : null;
  const rest = showFeatured ? events.slice(1) : events;

  return (
    <div className="flex flex-col gap-8">
      {featured ? <FeaturedEventCard event={featured} /> : null}

      {rest.length > 0 ? (
        <section className="flex flex-col gap-3 lg:gap-6">
          <SectionTitle>{showFeatured ? "Upcoming" : "Events"}</SectionTitle>
          {/* Rows on a phone (dividers between them), a card grid from `sm`
           * up. `divide-y` is dropped at the same breakpoint the cards gain
           * their own borders, or every card would carry a stray top rule. */}
          <div className="flex flex-col divide-y divide-border sm:grid sm:grid-cols-2 sm:gap-5 sm:divide-y-0 lg:grid-cols-3">
            {rest.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      ) : null}

      {totalPages > 1 ? (
        <Pagination page={page} totalPages={totalPages} params={params} />
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: SearchParams;
}) {
  const href = (target: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const value = one(v);
      if (value && k !== "page") next.set(k, value);
    }
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 border-t border-border pt-6"
    >
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="text-body font-bold text-accent hover:text-accent-hi"
        >
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-helper text-text-faint">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          className="text-body font-bold text-accent hover:text-accent-hi"
        >
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Mirrors the real results: one featured hero, then the card grid. */
function LoadingResults() {
  return (
    <div className="flex flex-col gap-8" aria-busy>
      <Skeleton className="aspect-[4/3] w-full rounded-card sm:aspect-[16/9] lg:aspect-[21/9]" />
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
