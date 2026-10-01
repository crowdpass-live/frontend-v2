"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

/** The event control room's sections. Grows with #42, #43 and #48. */
export function EventTabs({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = `/host/events/${eventId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/attendees`, label: "Attendees" },
  ];
  return (
    <nav aria-label="Event sections" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 border-b border-border">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
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
