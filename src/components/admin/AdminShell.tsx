"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { SessionUser } from "@/lib/normalize";
import { signOut, subscribeSession } from "@/lib/session-client";
import { expiredUrlFor } from "@/lib/session-token";
import { Logo } from "@/components/Logo";
import { BrandSpinner } from "@/components/BrandSpinner";
import { Container, cx } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Metrics" },
  { href: "/admin/expenses", label: "Expenses" },
  { href: "/admin/status", label: "Status" },
];

/**
 * Admin chrome and the role courtesy check.
 *
 * `user` comes from the server (`getCurrentUser()` in the layout), read off
 * the shared httpOnly session — the same sign-in as the rest of the app.
 * `null` means the API rejected the session; `undefined` means it could not
 * be asked (cold start, outage), in which case the shell renders anyway so
 * the status page still works during an incident.
 *
 * The role check is a courtesy, not a boundary. Every `/admin/*` route on the
 * API is `@Roles(UserRole.ADMIN)` and answers 403 to anything else. What this
 * does is stop someone who signed in as an ORGANIZER from staring at a wall
 * of failed requests without being told why — a different and much more
 * common problem than an attacker.
 */
export function AdminShell({
  user,
  children,
}: {
  user: SessionUser | null | undefined;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const onLoginPage = pathname === "/admin/login";
  const rejected = user === null && !onLoginPage;

  // The cookie is httpOnly, so another tab's sign-out is only visible
  // through the broadcast. Re-read the server session either way.
  useEffect(
    () =>
      subscribeSession((change) => {
        if (change === "signed-out") router.replace("/admin/login");
        router.refresh();
      }),
    [router],
  );

  // A dead token: clear it through the one expired-session path.
  useEffect(() => {
    if (rejected) window.location.assign(expiredUrlFor(pathname));
  }, [rejected, pathname]);

  async function leave() {
    await signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  // The login page carries its own layout.
  if (onLoginPage) return <>{children}</>;

  if (rejected) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <BrandSpinner width={88} label="Checking your session" />
      </div>
    );
  }

  if (user && user.role !== "ADMIN") {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <Logo variant="mark" height={28} />
          <h1 className="text-title font-bold text-text">Admin only</h1>
          <p className="text-body text-text-dim">
            You&apos;re signed in as{" "}
            <span className="text-text">{user.email || user.name}</span>, which
            is a <span className="text-text">{user.role}</span> account. These
            pages expose revenue across every organizer, so the API refuses
            them to anything but an ADMIN.
          </p>
          <button
            type="button"
            onClick={leave}
            className="text-body font-bold text-accent hover:text-accent-hi"
          >
            Sign in as someone else
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
        {/* Phones: logo and sign-out on one row, the tabs on a second — three
            tabs and both ends don't fit 320px on one. */}
        <Container
          size="page"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 sm:h-16 sm:flex-nowrap sm:py-0"
        >
          <Link href="/admin" className="flex shrink-0 items-center gap-2.5">
            <Logo variant="mark" height={20} />
            <span className="text-label font-bold tracking-wide text-text-dim">
              ADMIN
            </span>
          </Link>

          <nav className="order-last -mx-4 flex w-full items-center gap-1 sm:order-none sm:mx-0 sm:w-auto sm:flex-1">
            {NAV.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
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

          <button
            type="button"
            onClick={leave}
            className="ml-auto shrink-0 text-label text-text-faint transition-colors hover:text-text sm:ml-0"
          >
            Sign out
          </button>
        </Container>
      </header>

      <main className="flex-1 pb-20">{children}</main>
    </div>
  );
}
