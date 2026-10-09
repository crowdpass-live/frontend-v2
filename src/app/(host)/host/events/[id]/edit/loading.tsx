import { EventFormSkeleton } from "@/components/host/EventFormSkeleton";

/** Edit sits inside the event frame; just the form. */
export default function HostEditEventLoading() {
  return (
    <>
      <span className="sr-only" role="status">Loading the event form</span>
      <EventFormSkeleton />
    </>
  );
}
