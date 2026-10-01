import Link from "next/link";
import { CoverImage } from "@/components/CoverImage";
import { Badge, cx } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { count, ngnCompact, ngn, NO_VALUE } from "@/lib/metric-format";
import type { ApiOrganizerEvent, EventStatus } from "@/types/api";

const STATUS: Record<EventStatus, { label: string; tone: "ok" | "neutral" | "info" | "danger" }> = {
  PUBLISHED: { label: "Live", tone: "ok" },
  DRAFT: { label: "Draft", tone: "neutral" },
  COMPLETED: { label: "Ended", tone: "info" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

/**
 * One event on the dashboard: status, sales against capacity, revenue.
 * The whole card opens the event's control room.
 *
 * The sold percentage is `null`, not `0%`, for an event with no capacity —
 * there is nothing to divide by, and "0% sold" would read as a flop.
 */
export function OrganizerEventCard({ event }: { event: ApiOrganizerEvent }) {
  const { stats } = event;
  const status = STATUS[event.status] ?? { label: event.status, tone: "neutral" as const };
  const pct = stats.totalTickets
    ? Math.min(100, Math.round((stats.ticketsSold / stats.totalTickets) * 100))
    : null;

  return (
    <Link
      href={`/host/events/${event.id}`}
      className="group flex w-full flex-col overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-border-strong"
    >
      <div className="relative aspect-[16/7] bg-surface-strong">
        <CoverImage
          src={event.coverImage}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
          className="transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
        />
        <Badge tone={status.tone} className="absolute left-3 top-3 bg-bg/80 backdrop-blur">
          {status.label}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="min-w-0">
          <h3 className="truncate text-body font-bold text-text">{event.name}</h3>
          <p className="text-helper text-text-faint">{formatDate(event.startTime)}</p>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 text-label">
            <span className="text-text-dim">
              <span className="font-bold tabular-nums text-text">
                {count(stats.ticketsSold)}
              </span>{" "}
              / {count(stats.totalTickets)} sold
            </span>
            <span className="tabular-nums text-text-faint">
              {pct === null ? NO_VALUE : `${pct}%`}
            </span>
          </div>
          {/* Tinted track, accent fill: progress against capacity. */}
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-strong">
            <div
              className={cx("h-full rounded-full bg-accent", pct === 0 && "hidden")}
              style={{ width: `${pct ?? 0}%` }}
            />
          </div>
          <p
            className="text-label text-text-dim"
            title={ngn(stats.totalRevenue)}
          >
            <span className="font-bold tabular-nums text-text">
              {ngnCompact(stats.totalRevenue)}
            </span>{" "}
            revenue
          </p>
        </div>
      </div>
    </Link>
  );
}
