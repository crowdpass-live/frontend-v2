"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { ButtonLink, cx } from "@/components/ui";

export interface ShellNavItem {
  href: string;
  label: string;
  icon?: React.ReactNode;
  /** Active only on this exact path (a section home like /host). */
  exact?: boolean;
  /** Further path prefixes that belong to this item (an event under Dashboard). */
  also?: string[];
  /** A short nudge beside the label — a setup step that isn't done. */
  badge?: string;
}

export interface ShellNavSection {
  /** Omit for the first, untitled group. */
  title?: string;
  items: ShellNavItem[];
}

/**
 * Chrome for the working surfaces — `(host)` and `(door)`.
 *
 * Deliberately not the storefront header: someone running an event or a door
 * is at work, and "Browse events" plus a footer of legal links is clutter.
 *
 * - **Desktop (lg+):** a fixed sidebar holds the brand, the primary action and
 *   every nav link, grouped; the top bar keeps only the account menu.
 * - **Below lg:** the same sidebar is a drawer behind a menu button. A
 *   native `<dialog>` opened with `showModal()`, like `Sheet`: the page goes
 *   inert, focus stays inside, Escape and a backdrop tap close it, and it
 *   closes itself on navigation.
 *
 * With no nav (a signed-in buyer meeting "become a host"), there is no
 * sidebar or menu button at all — just the brand and the account.
 *
 * `account` is the server-rendered account slot, passed in so this stays a
 * thin client component for the active-link and drawer state.
 */
export function AppShell({
  label,
  home,
  sections = [],
  action,
  account,
  children,
}: {
  label: string;
  home: string;
  sections?: ShellNavSection[];
  /** The one primary action, at the top of the sidebar ("Create event"). */
  action?: { href: string; label: string };
  account: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hasNav = sections.some((s) => s.items.length > 0);
  const drawer = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = drawer.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  // Any navigation closes the drawer — including Back.
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) {
    setSeen(pathname);
    setOpen(false);
  }

  const brand = (
    <Link href={home} className="flex h-16 shrink-0 items-center gap-2.5">
      <Logo variant="mark" height={20} />
      <span className="text-label font-bold uppercase tracking-wide text-text-dim">{label}</span>
    </Link>
  );

  const nav = (
    <SidebarNav sections={sections} action={action} pathname={pathname} />
  );

  return (
    <div className={cx("min-h-dvh", hasNav && "lg:pl-64")}>
      {hasNav ? (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-bg lg:flex">
          <div className="border-b border-border px-5">{brand}</div>
          <div className="flex-1 overflow-y-auto px-3 py-5">{nav}</div>
        </aside>
      ) : null}

      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full items-center gap-2 px-5 sm:px-6 lg:px-8">
          {hasNav ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-haspopup="dialog"
              aria-expanded={open}
              className="-ml-2 grid size-10 place-items-center rounded-full text-text-dim transition-colors hover:bg-surface hover:text-text lg:hidden"
            >
              <MenuIcon />
            </button>
          ) : null}
          <div className={cx(hasNav && "lg:hidden")}>{brand}</div>
          <div className="ml-auto shrink-0">{account}</div>
        </div>
      </header>

      <main className="pb-20">{children}</main>

      {hasNav ? (
        <dialog
          ref={drawer}
          aria-label={`${label} menu`}
          onCancel={(e) => {
            e.preventDefault();
            setOpen(false);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
          className={
            "m-0 h-dvh max-h-dvh w-[min(18rem,85vw)] max-w-none border-r border-border bg-bg p-0 text-text shadow-2xl " +
            "backdrop:bg-black/70 backdrop:backdrop-blur-sm lg:hidden"
          }
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-5">
              {brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="-mr-2 grid size-10 place-items-center rounded-full text-text-dim transition-colors hover:text-text"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-5">{nav}</div>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}

function SidebarNav({
  sections,
  action,
  pathname,
}: {
  sections: ShellNavSection[];
  action?: { href: string; label: string };
  pathname: string;
}) {
  const isActive = (item: ShellNavItem) =>
    (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)) ||
    !!item.also?.some((prefix) => pathname.startsWith(prefix));

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {action ? (
        <ButtonLink href={action.href} size="sm" className="w-full">
          {action.label}
        </ButtonLink>
      ) : null}
      {sections
        .filter((s) => s.items.length)
        .map((section, i) => (
          <div key={section.title ?? i} className="flex flex-col gap-1">
            {section.title ? (
              <p className="px-3 pb-1 text-helper font-bold uppercase tracking-wide text-text-faint">
                {section.title}
              </p>
            ) : null}
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "relative flex min-h-10 items-center gap-3 rounded-control px-3 text-label font-medium transition-colors",
                        active ? "bg-surface text-text" : "text-text-dim hover:bg-surface hover:text-text",
                      )}
                    >
                      {active ? (
                        <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" />
                      ) : null}
                      {item.icon ? (
                        <span aria-hidden className={cx("shrink-0", active ? "text-accent" : "text-text-faint")}>
                          {item.icon}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-helper font-bold text-accent">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
    </nav>
  );
}
