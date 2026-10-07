import { Skeleton } from "@/components/Skeleton";

/** Member lists: intro, the ticket-type chips, the list manager. */
export default function HostMembersLoading() {
  return (
    <div className="flex flex-col gap-5">
      <span className="sr-only" role="status">Loading member lists</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-full max-w-2xl" />
        <div className="flex gap-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-10 w-28 rounded-full" />
          ))}
        </div>
      </div>
      <Skeleton className="h-40 rounded-card" />
      <Skeleton className="h-64 rounded-card" />
    </div>
  );
}
