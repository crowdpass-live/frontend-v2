import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getDoors, type DoorEvent } from "@/lib/door";
import { checkInWindow, type CheckInWindow } from "@/lib/door-window";
import { formatDateTimeLong } from "@/lib/format";
import { Badge, Container } from "@/components/ui";

export const metadata: Metadata = { title: "Check-in" };

const WINDOW: Record<CheckInWindow, { label: string; tone: "ok" | "neutral" | "info" }> = {
  open: { label: "Open now", tone: "ok" },
  upcoming: { label: "Not open yet", tone: "neutral" },
  ended: { label: "Ended", tone: "info" },
};

/**
 * Each door with where it stands right now, open first, then upcoming
 * soonest-first, then ended. The clock is read once, here, so every row is
 * judged against the same instant.
 */
function withWindows(doors: DoorEvent[]) {
  const now = Date.now();
  const rank = { open: 0, upcoming: 1, ended: 2 } as const;
  return doors
    .map((door) => ({ door, window: checkInWindow(door, now) }))
    .sort((a, b) => {
      if (a.window !== b.window) return rank[a.window] - rank[b.window];
      const ta = new Date(a.door.startTime).getTime();
      const tb = new Date(b.door.startTime).getTime();
      return a.window === "ended" ? tb - ta : ta - tb;
    });
}

/**
 * The doors this account may work (#45). Ports `ScanEventsScreen.js`, plus
 * the organizer's own live events, which the app reaches from analytics.
 *
 * "Not open yet" and "Ended" read differently on purpose: someone standing
 * at a door wants to know whether they are early or late. Check-in opens at
 * the event's start time exactly — the backend refuses scans before it.
 */
export default async function DoorHomePage() {
  await requireUser();
  const doors = withWindows((await getDoors()) ?? []);

  return (
    <Container size="page" className="flex flex-col gap-4 py-8 sm:py-10">
      <h1 className="text-title font-bold text-text">Your doors</h1>
      {/* grid-cols-1, not just md:/xl: — the implicit column stretches to a long name. */}
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {doors.map(({ door: d, window: w }) => {
          return (
            <li key={d.eventId} className="flex min-w-0">
              <Link
                href={`/door/${d.eventId}`}
                className="flex min-h-16 w-full flex-col gap-2 rounded-card border border-border bg-surface px-5 py-4 transition-colors hover:border-border-strong"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-body font-bold text-text">{d.name}</span>
                  <Badge tone={WINDOW[w].tone} className="shrink-0">{WINDOW[w].label}</Badge>
                </span>
                <span className="text-helper text-text-faint">
                  {w === "upcoming" ? `Opens ${formatDateTimeLong(d.startTime)}` : formatDateTimeLong(d.startTime)}
                  {d.venue ? ` · ${d.venue}` : ""}
                </span>
                <span className="text-helper text-text-faint">
                  {d.own ? "Your event" : `For ${d.organizerName ?? "an organizer"}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
