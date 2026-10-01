"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Container, cx } from "@/components/ui";

export interface ShellNavItem {
  href: string;
  label: string;
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
        <Container size="page" className="flex h-16 items-center gap-4 sm:gap-6">
          <Link href={home} className="flex shrink-0 items-center gap-2.5">
            <Logo variant="mark" height={20} />
            <span className="text-label font-bold uppercase tracking-wide text-text-dim">
              {label}
            </span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-1">
            {nav.map((item) => {
              const active =
                item.href === home
                  ? pathname === home
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "rounded-full px-4 py-2 text-label font-medium transition-colors",
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

          <div className="shrink-0">{account}</div>
        </Container>
      </header>

      <main className="flex-1 pb-20">{children}</main>
    </div>
  );
}
