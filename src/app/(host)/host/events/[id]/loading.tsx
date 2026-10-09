import { Skeleton } from "@/components/Skeleton";
import { OverviewTiles } from "@/components/host/OverviewTiles";

/** The overview tab: tiles, the daily-sales chart, the two panels. */
export default function HostEventOverviewLoading() {
  return (
    <div className="flex flex-col gap-6">
      <span className="sr-only" role="status">Loading the overview</span>
      <OverviewTiles />
      <Skeleton className="h-72 rounded-card" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Skeleton className="h-64 rounded-card" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    </div>
  );
}
