import { Container } from "@/components/ui";
import { Skeleton } from "@/components/Skeleton";
import { BrandSpinner } from "@/components/BrandSpinner";

/**
 * The ticket is the one page a buyer opens at a door, often on a bad
 * connection, so the wait gets the brand mark rather than grey blocks alone —
 * it reads as "CrowdPass is working" instead of "this page is broken".
 */
export default function Loading() {
  return (
    <main className="flex flex-1 flex-col py-8 lg:py-16">
      <Container className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>

        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <div className="flex flex-col gap-2 p-5">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex flex-col items-center gap-4 border-t border-border py-14">
            <BrandSpinner width={92} label="Loading your ticket" />
            <p className="text-helper text-text-faint">Loading your ticket…</p>
          </div>
        </div>
      </Container>
    </main>
  );
}
