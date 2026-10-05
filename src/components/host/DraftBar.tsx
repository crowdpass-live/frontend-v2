"use client";

import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui";

/**
 * The strip on every tab of a DRAFT event: what a draft is, and what to do
 * next. Hidden on the edit page itself, where it would point at itself.
 */
export function DraftBar({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  if (pathname.endsWith("/edit")) return null;
  return (
    <section
      aria-label="Draft"
      className="flex flex-col gap-3 rounded-card border border-accent/30 bg-accent-tint p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="text-body font-bold text-text">This is a draft — only you can see it.</p>
        <p className="text-label text-text-dim">Check the details, then publish to start selling.</p>
      </div>
      <ButtonLink href={`/host/events/${eventId}/edit`} variant="secondary" size="sm" className="w-full shrink-0 sm:w-auto">
        Edit draft
      </ButtonLink>
    </section>
  );
}
