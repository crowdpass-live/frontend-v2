import { Skeleton } from "@/components/Skeleton";

/** Referrals: the intro and button, three tallies, the ranked links. */
export default function HostReferralsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <span className="sr-only" role="status">Loading referrals</span>
      <Skeleton className="h-10 rounded-control sm:w-2/3" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-card" />
        ))}
      </div>
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-48 rounded-card" />
      ))}
    </div>
  );
}
