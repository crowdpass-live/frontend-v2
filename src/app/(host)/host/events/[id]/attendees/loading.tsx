import { Skeleton } from "@/components/Skeleton";

/** Attendees: the four facts and export, search, status chips, the list. */
export default function HostAttendeesLoading() {
  return (
    <div className="flex flex-col gap-5">
      <span className="sr-only" role="status">Loading attendees</span>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-24" />
          ))}
        </div>
        <Skeleton className="h-10 w-36 rounded-control" />
      </div>
      <Skeleton className="h-10 rounded-control" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-card" />
    </div>
  );
}
