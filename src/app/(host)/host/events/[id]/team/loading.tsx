import { Skeleton } from "@/components/Skeleton";

/** Check-in team: intro, the add card, the list. */
export default function HostTeamLoading() {
  return (
    <div className="flex flex-col gap-6">
      <span className="sr-only" role="status">Loading the check-in team</span>
      <Skeleton className="h-10 w-full max-w-2xl" />
      <Skeleton className="h-36 rounded-card" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-32 rounded-card" />
    </div>
  );
}
