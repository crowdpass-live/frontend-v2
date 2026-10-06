import { Skeleton } from "@/components/Skeleton";

/** The overview's five tiles, at both of their grid shapes. */
export function OverviewTiles() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className={i === 0 ? "col-span-2 h-[104px] rounded-card lg:col-span-1" : "h-[104px] rounded-card"} />
      ))}
    </div>
  );
}
