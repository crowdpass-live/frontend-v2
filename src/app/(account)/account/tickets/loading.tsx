import { Skeleton } from "@/components/Skeleton";
import { Container } from "@/components/ui";

/** Mirrors My tickets: heading, intro, then ticket rows. */
export default function MyTicketsLoading() {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <span className="sr-only" role="status">Loading your tickets</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[90px] rounded-card sm:h-[106px]" />
        ))}
      </div>
    </Container>
  );
}
