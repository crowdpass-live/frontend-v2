import { Badge } from "./ui";
import { CoverImage } from "./CoverImage";

/**
 * The event's hero image with the title and category chip laid over its
 * bottom edge (design `12-event-detail.png`).
 */
export function EventCover({
  src,
  title,
  category,
}: {
  src: string | null;
  title: string;
  category: string;
}) {
  return (
    // Square-ish on a phone where it is full-bleed; flatter and rounded once
    // it sits inside the page container.
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface sm:aspect-[16/9] sm:rounded-card lg:aspect-[21/9]">
      <CoverImage src={src} priority sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1152px" />

      {/* Not decoration: the title sits directly on the photo, and a bright
       * cover would otherwise render white text unreadable. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-bg via-bg/85 to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-5 sm:p-8 lg:p-10">
        {category ? <Badge tone="accent">{category}</Badge> : null}
        <h1 className="max-w-3xl text-title font-bold text-text text-balance sm:text-display lg:text-6xl">
          {title}
        </h1>
      </div>
    </div>
  );
}
