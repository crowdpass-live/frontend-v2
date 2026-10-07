import { Skeleton } from "@/components/Skeleton";
import { Container } from "@/components/ui";

/** One door: back link, event name, then the console (scanner + roster). */
export default function DoorConsoleLoading() {
  return (
    <Container size="page" className="flex flex-col gap-5 py-6 sm:py-8">
      <span className="sr-only" role="status">Opening the door</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-7 w-64 max-w-full" />
      </div>
      {/* DoorConsole's own switch (WIDE, 1024px): the console alone on a
          phone; console beside the guest list from lg. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-8 xl:gap-12">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-11 rounded-control" />
          <Skeleton className="aspect-square w-full rounded-card" />
        </div>
        <div className="hidden flex-col gap-3 lg:flex">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-10 rounded-control" />
          <Skeleton className="h-80 rounded-card" />
        </div>
      </div>
    </Container>
  );
}
