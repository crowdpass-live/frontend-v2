"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cx } from "@/components/ui";

/** The event control room's sections. Grows with #42, #43 and #48. */
export function EventTabs({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  // On a phone the strip scrolls sideways, and a later tab (Check-in team)
  // would otherwise be active but off-screen. Bring it into view — without
  // scrolling the page itself vertically.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);
  const base = `/host/events/${eventId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/attendees`, label: "Attendees" },
    { href: `${base}/members`, label: "Member lists" },
    { href: `${base}/team`, label: "Check-in team" },
    // Opens the door console (its own shell) — an organizer may always scan
    // their own event, no grant needed.
    { href: `/door/${eventId}`, label: "Check-in" },
  ];
  return (
    <nav aria-label="Event sections" className="-mx-5 scroll-px-5 overflow-x-auto px-5 sm:mx-0 sm:scroll-px-0 sm:px-0">
      <ul className="flex w-max gap-1 border-b border-border">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                ref={active ? activeRef : undefined}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "-mb-px block whitespace-nowrap border-b-2 px-4 py-3 text-label font-medium transition-colors",
                  active
                    ? "border-accent text-text"
                    : "border-transparent text-text-dim hover:text-text",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
