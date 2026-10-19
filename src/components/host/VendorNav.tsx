"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

/** Applications vs. stall setup, under the event's Vendors tab. */
export function VendorNav({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const base = `/host/events/${eventId}/vendors`;
  const links = [
    { href: base, label: "Applications" },
    { href: `${base}/setup`, label: "Stalls & registration" },
  ];
  return (
    <nav aria-label="Vendors" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-10 items-center whitespace-nowrap rounded-full border px-4 text-label transition-colors",
                  active
                    ? "border-accent bg-accent-tint text-text"
                    : "border-border bg-surface text-text-dim hover:text-text",
                )}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
