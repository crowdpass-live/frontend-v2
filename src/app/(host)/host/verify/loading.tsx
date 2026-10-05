import { Skeleton } from "@/components/Skeleton";
import { Container } from "@/components/ui";

/** Mirrors the form: heading, the name card, the ID picker and field. */
export default function VerifyIdentityLoading() {
  return (
    <Container className="flex flex-col gap-6 py-10">
      <span className="sr-only" role="status">Loading verification</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
      <Skeleton className="h-28 rounded-card" />
      <Skeleton className="h-12 rounded-control" />
      <Skeleton className="h-14 rounded-control" />
    </Container>
  );
}
