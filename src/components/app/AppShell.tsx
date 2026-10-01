"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Container, cx } from "@/components/ui";

export interface ShellNavItem {
  href: string;
  label: string;
  /** Further path prefixes that belong to this item (an event under Dashboard). */
  also?: string[];
}

/**
 * Chrome for the working surfaces — `(host)` and `(door)`.
 *
 * Deliberately not the storefront header: someone running an event or a door
 * is at work, and "Browse events" plus a footer of legal links is clutter.
 * The logo still goes home. `account` is the server-rendered account slot,
 * passed in so this stays a thin client component for the active-link state.
 */
export function AppShell({
  label,
  home,
  nav = [],
  account,
  children,
}: {
  label: string;
  home: string;
  nav?: ShellNavItem[];
  account: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        {/* Phones: logo and account on one row, the nav on its own row
            below — three items plus the avatar do not fit 320px, and a
            sideways-scrolling nav hides its own items. Inline from sm. */}
        <Container size="page" className="flex flex-wrap items-center gap-x-4 sm:flex-nowrap sm:gap-x-6">
          <Link href={home} className="flex h-16 shrink-0 items-center gap-2.5">
            <Logo variant="mark" height={20} />
            <span className="text-label font-bold uppercase tracking-wide text-text-dim">
              {label}
            </span>
          </Link>

          <div className="ml-auto shrink-0 sm:order-last">{account}</div>

          {nav.length ? (
            <nav className="-mx-5 flex w-[calc(100%+2.5rem)] items-center gap-1 overflow-x-auto px-5 pb-3 sm:mx-0 sm:w-auto sm:min-w-0 sm:flex-1 sm:px-0 sm:pb-0">
              {nav.map((item) => {
                const active =
                  (item.href === home
                    ? pathname === home
                    : pathname.startsWith(item.href)) ||
                  !!item.also?.some((prefix) => pathname.startsWith(prefix));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "inline-flex min-h-10 items-center whitespace-nowrap rounded-full px-3 text-label font-medium transition-colors sm:px-4",
                      active
                        ? "bg-surface text-text"
                        : "text-text-dim hover:bg-surface hover:text-text",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </Container>
      </header>

      <main className="flex-1 pb-20">{children}</main>
    </div>
  );
}
