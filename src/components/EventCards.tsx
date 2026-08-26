import Link from "next/link";
import { CoverImage } from "./CoverImage";
import { formatDate, formatTime, money } from "@/lib/format";
import type { ApiEventListItem } from "@/types/api";

/**
 * `"Sat · 10pm"` — the pill on the featured card in the design.
 *
 * On-the-hour times drop the `:00` (`10:00 PM` → `10pm`); anything else keeps
 * its minutes (`11:47 AM` → `11:47am`). Lowercase meridiem, per the design.
 */
function whenTag(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("en-US", {
    timeZone: "Africa/Lagos",
    weekday: "short",
  });
  const time = formatTime(iso)
    .replace(/:00(?=\s)/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  return `${day} · ${time}`;
}

/** `"from ₦8,000"`, or `"Free"`. Uses the list endpoint's computed minPrice. */
function priceLabel(event: ApiEventListItem): string {
  const from = money(event.minPrice, event.currency || "NGN");
  return from === "Free" ? "Free" : `from ${from}`;
}

/**
 * The hero card at the top of Discover (design `10-discover-home.png`).
 *
 * The whole card is the link, with the CTA drawn as a button inside it — a
 * nested `<a>` would be invalid HTML and a nested `<button>` would swallow the
 * tap on touch devices.
 *
 * The aspect ratio flattens as the viewport grows (4:3 → 16:9 → 21:9). A tall
 * card that works on a phone becomes an enormous letterbox on a desktop,
 * pushing everything below it off the first screen.
 */
export function FeaturedEventCard({ event }: { event: ApiEventListItem }) {
  const soldOut = event.totalAvailable <= 0;
  const where = [event.venue, event.location].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group relative block aspect-[4/3] w-full overflow-hidden rounded-card bg-surface sm:aspect-[16/9] lg:aspect-[21/9]"
    >
      <CoverImage
        src={event.coverImage}
        priority
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1152px"
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10"
      />

      <span className="absolute left-4 top-4 rounded-full bg-accent px-3 py-1.5 text-helper font-bold text-ink lg:left-8 lg:top-8">
        {soldOut ? "Sold out" : whenTag(event.startTime)}
      </span>

      {/* Stacked on a phone, one row on a wide card — at 21:9 there is plenty
       * of horizontal room and stacking wastes it. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:p-8">
        <div className="min-w-0">
          <p className="text-section font-bold text-white text-balance lg:text-display">
            {event.name}
          </p>
          {where ? (
            <p className="mt-0.5 truncate text-label text-white/70 lg:mt-2 lg:text-body">
              {where}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 lg:gap-6">
          <span className="text-body font-bold text-white lg:text-section">
            {priceLabel(event)}
          </span>
          <span className="inline-flex h-11 items-center justify-center rounded-control bg-white px-5 text-label font-bold text-ink transition-colors group-hover:bg-white/90 lg:h-14 lg:px-8 lg:text-body">
            Get tickets
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * One event in the "Upcoming" list.
 *
 * The same component in two shapes, switched at `sm` with CSS rather than by
 * rendering two trees:
 *
 *   - **Phone:** a compact row — thumbnail, text, price. Density matters on a
 *     small screen, and it is what the design draws.
 *   - **Tablet and up:** a poster card in a grid. Stretching a 56px-thumbnail
 *     row to 1100px wide leaves a tiny image marooned beside an ocean of
 *     empty space; at that width a cover is the point.
 *
 * Only the price appears twice, because it sits at the end of the row on a
 * phone and under the title on a card. It is one short string, and duplicating
 * it costs less than a second component that drifts out of sync.
 */
export function EventCard({ event }: { event: ApiEventListItem }) {
  const soldOut = event.totalAvailable <= 0;
  const meta = [formatDate(event.startTime), event.venue]
    .filter(Boolean)
    .join(" · ");
  const price = soldOut
    ? "Sold out"
    : money(event.minPrice, event.currency || "NGN");
  const priceTone = soldOut ? "text-text-faint" : "text-text";

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex items-center gap-4 rounded-card py-3 transition-colors hover:bg-surface sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-hidden sm:border sm:border-border sm:bg-surface sm:py-0 sm:hover:border-border-strong sm:hover:bg-surface-strong"
    >
      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-surface sm:aspect-[4/3] sm:size-auto sm:w-full sm:rounded-none">
        <CoverImage
          src={event.coverImage}
          sizes="(max-width: 640px) 56px, (max-width: 1024px) 45vw, 360px"
        />
      </span>

      <span className="flex min-w-0 flex-1 flex-col sm:gap-2 sm:p-4">
        <span className="truncate text-body font-semibold text-text sm:whitespace-normal sm:line-clamp-2">
          {event.name}
        </span>
        <span className="truncate text-helper text-text-faint sm:text-label">
          {meta}
        </span>
        {/* Card layout only — the row puts price at the far right instead. */}
        <span
          className={`mt-auto hidden pt-2 text-body font-bold sm:block ${priceTone}`}
        >
          {price}
        </span>
      </span>

      <span className={`shrink-0 text-body font-bold sm:hidden ${priceTone}`}>
        {price}
      </span>
    </Link>
  );
}
