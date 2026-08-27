import { cx } from "./ui";

/**
 * A placeholder shaped like the content it stands in for.
 *
 * Used in `loading.tsx` route segments, so navigating to an event or a ticket
 * paints the page's real structure immediately instead of a blank screen while
 * the server fetches. The shapes deliberately mirror the finished layout —
 * a skeleton that does not match what arrives is a worse experience than no
 * skeleton, because the page visibly reflows under the reader.
 */
export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      {...props}
      aria-hidden
      className={cx("skeleton rounded-lg", className)}
    />
  );
}

/** One event row/card in the Discover list, at both of its breakpoint shapes. */
export function EventCardSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 sm:flex-col sm:items-stretch sm:gap-0 sm:overflow-hidden sm:rounded-card sm:border sm:border-border sm:py-0">
      <Skeleton className="size-14 shrink-0 rounded-xl sm:aspect-[4/3] sm:size-auto sm:w-full sm:rounded-none" />
      <div className="flex flex-1 flex-col gap-2 sm:p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-14 shrink-0 sm:hidden" />
    </div>
  );
}
