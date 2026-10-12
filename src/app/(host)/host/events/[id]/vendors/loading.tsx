import { Skeleton } from "@/components/Skeleton";

/** Vendors: the facts, status tabs, search and filters, the cards. */
export default function HostVendorsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <span className="sr-only" role="status">Loading vendors</span>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-6 w-24" />
        ))}
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-10 rounded-control" />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-56 rounded-card" />
        ))}
      </div>
    </div>
  );
}
