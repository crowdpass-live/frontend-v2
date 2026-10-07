import { Skeleton } from "@/components/Skeleton";
import { Container } from "@/components/ui";

/** Payouts and partner earnings share a shape: header, tiles, a list. */
export function MoneyPageSkeleton({ label, tiles }: { label: string; tiles: 2 | 3 }) {
  return (
    <Container size="page" className="flex flex-col gap-6 py-8 sm:py-10">
      <span className="sr-only" role="status">{label}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: tiles }, (_, i) => (
          <Skeleton
            key={i}
            className={tiles === 3 && i === 0 ? "col-span-2 h-[104px] rounded-card sm:col-span-1" : "h-[104px] rounded-card"}
          />
        ))}
      </div>
      <Skeleton className="h-72 rounded-card" />
    </Container>
  );
}
