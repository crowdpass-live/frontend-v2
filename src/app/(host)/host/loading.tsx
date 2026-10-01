import { Skeleton } from "@/components/Skeleton";
import { Container } from "@/components/ui";

/** Mirrors the dashboard: greeting, three tiles, the chart panel, cards. */
export default function HostDashboardLoading() {
  return (
    <Container size="page" className="flex flex-col gap-8 py-8 sm:py-10">
      <span className="sr-only" role="status">Loading your dashboard</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[104px] rounded-card" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-card" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-64 rounded-card" />
        ))}
      </div>
    </Container>
  );
}
