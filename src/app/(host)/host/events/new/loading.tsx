import { Skeleton } from "@/components/Skeleton";
import { EventFormSkeleton } from "@/components/host/EventFormSkeleton";
import { Container } from "@/components/ui";

/** Create an event: back link, title, the form. */
export default function HostNewEventLoading() {
  return (
    <Container size="page" className="flex flex-col gap-6 py-8 sm:py-10">
      <span className="sr-only" role="status">Loading the event form</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-7 w-56" />
      </div>
      <EventFormSkeleton />
    </Container>
  );
}
