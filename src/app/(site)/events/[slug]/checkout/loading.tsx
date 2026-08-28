import { Container } from "@/components/ui";
import { Skeleton } from "@/components/Skeleton";

/** Mirrors the checkout grid: form left, order summary right from `lg`. */
export default function Loading() {
  return (
    <main className="flex flex-1 flex-col pb-40 lg:pb-16">
      <Container size="page" className="flex flex-col gap-8 pt-6 lg:pt-12">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <Skeleton className="h-6 w-28" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-12">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-5 w-28" />
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="size-8 shrink-0 rounded-lg" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-4 w-16 shrink-0" />
              </div>
            ))}
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-14 w-full rounded-control" />
            <Skeleton className="h-14 w-full rounded-control" />
          </div>
          <Skeleton className="hidden h-56 w-full rounded-card lg:block" />
        </div>
      </Container>
    </main>
  );
}
