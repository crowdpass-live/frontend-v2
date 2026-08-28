"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { clearSession } from "@/lib/admin-auth";
import { useAdminSession } from "@/lib/use-admin-session";
import { useHydrated } from "@/lib/use-hydrated";
import { Logo } from "@/components/Logo";
import { BrandSpinner } from "@/components/BrandSpinner";
import { Container, cx } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Metrics" },
  { href: "/admin/status", label: "Status" },
];

/**
 * Admin chrome and the sign-in gate.
 *
 * The gate is a courtesy, not a boundary. Every `/admin/*` route on the API is
 * `@Roles(UserRole.ADMIN)` and answers 403 to anything else, so a forged
 * localStorage session buys an empty dashboard, not data. What this does is
 * stop someone who signed in as an ORGANIZER from staring at a wall of failed
 * requests without being told why — a different and much more common problem
 * than an attacker.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const session = useAdminSession();
  const hydrated = useHydrated();
  const pathname = usePathname();
  const router = useRouter();

  const onLoginPage = pathname === "/admin/login";
  const signedIn = !!session;
  const isAdmin = session?.user.role === "ADMIN";

  useEffect(() => {
    if (!hydrated || onLoginPage) return;
    if (!signedIn) router.replace("/admin/login");
  }, [hydrated, onLoginPage, signedIn, router]);

  // The login page carries its own layout.
  if (onLoginPage) return <>{children}</>;

  // Storage is unreadable during SSR, so hold rather than flash "signed out".
  if (!hydrated || (!signedIn && !onLoginPage)) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <BrandSpinner width={88} label="Checking your session" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-dvh place-items-center px-6">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <Logo variant="mark" height={28} />
          <h1 className="text-title font-bold text-text">Admin only</h1>
          <p className="text-body text-text-dim">
            You&apos;re signed in as{" "}
            <span className="text-text">{session?.user.email}</span>, which is a{" "}
            <span className="text-text">{session?.user.role}</span> account.
            These pages expose revenue across every organizer, so the API
            refuses them to anything but an ADMIN.
          </p>
          <button
            type="button"
            onClick={() => {
              clearSession();
              router.replace("/admin/login");
            }}
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
        <Container size="page" className="flex h-16 items-center gap-6">
          <Link href="/admin" className="flex shrink-0 items-center gap-2.5">
            <Logo variant="mark" height={20} />
            <span className="text-label font-bold tracking-wide text-text-dim">
              ADMIN
            </span>
          </Link>

          <nav className="flex flex-1 items-center gap-1">
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
            onClick={() => {
              clearSession();
              router.replace("/admin/login");
            }}
            className="shrink-0 text-label text-text-faint transition-colors hover:text-text"
          >
            Sign out
          </button>
        </Container>
      </header>

      <main className="flex-1 pb-20">{children}</main>
    </div>
  );
}
