import { Skeleton } from "@/components/Skeleton";
import { Container } from "@/components/ui";

/** Mirrors the page: heading, then the account or connect card. */
export default function PayoutAccountLoading() {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <span className="sr-only" role="status">Loading your payout account</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-56 max-w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
      <Skeleton className="h-36 rounded-card" />
      <Skeleton className="h-40 rounded-card" />
    </Container>
  );
}
