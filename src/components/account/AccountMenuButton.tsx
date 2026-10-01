"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/lib/session-client";
import { CaretDownIcon } from "@/components/icons";
import { cx } from "@/components/ui";

export interface AccountLink {
  href: string;
  label: string;
}

/**
 * The account disclosure: an avatar button and a panel of links.
 *
 * A disclosure, not an ARIA `menu` — the items are plain navigation links,
 * and the menu role promises arrow-key behaviour a link list should not
 * fake. Closes on Escape (focus returns to the button), on a click outside,
 * and on navigation.
 */
export function AccountMenuButton({
  name,
  email,
  links,
}: {
  name: string;
  email: string;
  links: AccountLink[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Navigating closes the panel. Adjusted during render rather than in an
  // effect, so the closed state paints with the new page, not a frame after.
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function leave() {
    setLeaving(true);
    try {
      await signOut();
    } finally {
      router.replace("/");
      router.refresh();
    }
  }

  const initial = (name.trim()[0] ?? "?").toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Account menu for ${name}`}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((o) => !o);
        }}
        className="flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-text-dim transition-colors hover:bg-surface hover:text-text"
      >
        <span className="grid size-8 place-items-center rounded-full bg-accent-tint text-label font-bold text-accent">
          {initial}
        </span>
        <CaretDownIcon width={16} height={16} />
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-40 mt-2 w-64 rounded-card border border-border bg-surface p-2 shadow-2xl shadow-black/60"
      >
        <div className="border-b border-border px-3 pb-3 pt-2">
          <p className="truncate text-body font-bold text-text">{name}</p>
          {email ? (
            <p className="truncate text-helper text-text-faint">{email}</p>
          ) : null}
        </div>
        <ul className="flex flex-col py-1">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cx(
                  "block rounded-control px-3 py-2.5 text-label transition-colors hover:bg-surface-strong",
                  pathname === link.href ? "text-text" : "text-text-dim",
                )}
                aria-current={pathname === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-t border-border pt-1">
          <button
            type="button"
            onClick={leave}
            disabled={leaving}
            className="w-full rounded-control px-3 py-2.5 text-left text-label text-text-dim transition-colors hover:bg-surface-strong hover:text-text disabled:opacity-45"
          >
            {leaving ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
