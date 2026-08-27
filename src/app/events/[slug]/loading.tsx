import { Container } from "@/components/ui";
import { Skeleton } from "@/components/Skeleton";

/**
 * Shown while the event is fetched server-side.
 *
 * Mirrors `page.tsx` exactly — full-bleed hero on a phone, inset from `sm`,
 * two columns from `lg` with the ticket rail on the right — so the real page
 * lands into the same shape instead of reflowing under the reader.
 */
export default function Loading() {
  return (
    <main className="flex flex-1 flex-col pb-32 lg:pb-16">
      <Container size="page" className="px-0 sm:px-6 lg:px-8 lg:pt-8">
        <Skeleton className="aspect-[4/3] w-full rounded-none sm:aspect-[16/9] sm:rounded-card lg:aspect-[21/9]" />
      </Container>

      <Container
        size="page"
        className="grid grid-cols-1 gap-8 pt-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-12 lg:pt-12"
      >
        <div className="flex flex-col gap-8 lg:gap-10">
          <section className="flex flex-col gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="size-12 shrink-0 rounded-control" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-3/4" />
          </section>
        </div>

        <aside className="flex flex-col gap-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-[76px] w-full rounded-card" />
          <Skeleton className="h-[76px] w-full rounded-card" />
        </aside>
      </Container>
    </main>
  );
}
