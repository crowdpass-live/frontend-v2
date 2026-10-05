import { Skeleton } from "@/components/Skeleton";

/** Mirrors revenue sharing: intro, two tiles, the partner list, the add card. */
export default function RevenueSharingLoading() {
  return (
    <div className="flex flex-col gap-6">
      <span className="sr-only" role="status">Loading revenue partners</span>
      <Skeleton className="h-10 w-full max-w-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Skeleton className="h-[92px] rounded-card" />
        <Skeleton className="h-[92px] rounded-card" />
      </div>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-36 rounded-card" />
      <Skeleton className="h-40 rounded-card" />
    </div>
  );
}
