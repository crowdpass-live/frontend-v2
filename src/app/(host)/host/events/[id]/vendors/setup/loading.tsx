import { Skeleton } from "@/components/Skeleton";

/** Stalls & registration: the switch card, then the stall list. */
export default function HostVendorSetupLoading() {
  return (
    <div className="flex flex-col gap-6">
      <span className="sr-only" role="status">Loading stalls</span>
      <Skeleton className="h-48 rounded-card" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-40 rounded-card" />
    </div>
  );
}
