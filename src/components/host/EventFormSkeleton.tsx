import { Skeleton } from "@/components/Skeleton";

/** The create/edit event form's sections, for both routes' loading states. */
export function EventFormSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="aspect-video w-full max-w-2xl rounded-card" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex max-w-2xl flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-14 rounded-control" />
          <Skeleton className="h-14 rounded-control" />
        </div>
      ))}
    </div>
  );
}
