import { Skeleton } from "@/components/Skeleton";
import { Container } from "@/components/ui";

/** The profile: identity row, stat strip, wallet card, links, hosting card. */
export default function AccountLoading() {
  return (
    <Container className="flex flex-col gap-8 py-10">
      <span className="sr-only" role="status">Loading your account</span>
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-52 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-[76px] rounded-card" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-[218px] rounded-card" />
      </div>
      <Skeleton className="h-14 rounded-card" />
      <Skeleton className="h-40 rounded-card" />
    </Container>
  );
}
