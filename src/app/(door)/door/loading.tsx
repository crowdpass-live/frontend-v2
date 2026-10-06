import { Skeleton } from "@/components/Skeleton";
import { Container } from "@/components/ui";

/** Your doors: title and the grid of event cards. */
export default function DoorListLoading() {
  return (
    <Container size="page" className="flex flex-col gap-4 py-8 sm:py-10">
      <span className="sr-only" role="status">Loading your doors</span>
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
    </Container>
  );
}
