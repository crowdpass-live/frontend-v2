import { Skeleton } from "@/components/Skeleton";
import { OverviewTiles } from "@/components/host/OverviewTiles";
import { Container } from "@/components/ui";

/**
 * While an event's layout reads its analytics: the control-room frame —
 * back link, name and status, the status bar, the tab strip — then the
 * overview's tiles. Without this the nearest boundary is the dashboard's
 * skeleton, a different page's shape.
 */
export default function HostEventFrameLoading() {
  return (
    <Container size="page" className="flex flex-col gap-6 py-8">
      <span className="sr-only" role="status">Loading the event</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-16 rounded-card" />
      <Skeleton className="h-11 w-full max-w-xl" />
      <OverviewTiles />
    </Container>
  );
}
