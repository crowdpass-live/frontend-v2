import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { fetchMyTickets } from "@/lib/my-tickets";
import { walletViews } from "@/lib/wallets";
import { ProfileForm } from "@/components/account/ProfileForm";
import { WalletCard } from "@/components/account/WalletCard";
import { Skeleton } from "@/components/Skeleton";
import { ArrowRightIcon, ChevronRightIcon } from "@/components/icons";
import { Badge, ButtonLink, Container } from "@/components/ui";
import type { ApiWallet } from "@/types/api";

export const metadata: Metadata = { title: "Account" };

/**
 * The profile page (#26): identity, a stat strip, the USDC wallet card,
 * hosting, and your details (#27). Ports the readable parts of
 * `ProfileScreen.js`.
 *
 * The wallet card streams in behind Suspense — balances are live RPC reads,
 * and a slow chain must not hold the rest of the page. The Settings rows
 * mobile shows (payment, notifications) are inert there and have no backend,
 * so they are not ported.
 */
export default async function AccountPage() {
  const user = await requireUser();
  const ticketCount = await fetchMyTickets(1, 1)
    .then((r) => r.pagination.total)
    .catch(() => null);
  const initials =
    [user.firstName, user.lastName]
      .map((n) => n.trim()[0] ?? "")
      .join("")
      .toUpperCase() || (user.name[0] ?? "?").toUpperCase();

  return (
    <Container className="flex flex-col gap-8 py-10">
      <header className="flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-16 shrink-0 place-items-center rounded-full border border-border bg-surface text-section font-bold text-text-dim"
        >
          {initials}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="truncate text-title font-bold text-text">{user.name}</h1>
          {user.email ? (
            <p className="truncate text-label text-text-dim">{user.email}</p>
          ) : null}
          {user.isOrganizer ? <Badge tone="accent" className="self-start">Host</Badge> : null}
        </div>
        <ButtonLink href="#details" variant="secondary" size="sm" className="w-auto shrink-0">
          Edit
        </ButtonLink>
      </header>

      <div className="grid grid-cols-3 divide-x divide-border rounded-card border border-border bg-surface py-4 text-center">
        <Stat
          label="Tickets"
          value={ticketCount === null ? "—" : String(ticketCount)}
          href="/account/tickets"
        />
        <Stat label="Wallets" value={String(user.wallets.length)} />
        <Stat label="Member since" value={memberSince(user.createdAt)} />
      </div>

      <section aria-labelledby="wallet-heading" className="flex flex-col gap-3">
        <h2 id="wallet-heading" className="text-section font-bold text-text">Wallet</h2>
        {user.wallets.length ? (
          <Suspense fallback={<Skeleton className="h-[218px] rounded-card" />}>
            <Wallets wallets={user.wallets} />
          </Suspense>
        ) : (
          <p className="rounded-card border border-border bg-surface p-5 text-body text-text-dim">
            Your CrowdPass wallet is created with your account. It hasn&apos;t
            appeared yet — check back in a minute.
          </p>
        )}
        <p className="text-helper text-text-faint">
          A custodial USDC wallet CrowdPass holds for you. Crypto ticket
          purchases are paid from it first.
        </p>
      </section>

      <Link
        href="/account/tickets"
        className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-strong"
      >
        <span className="text-body font-medium text-text">My tickets</span>
        <ChevronRightIcon className="text-text-faint" />
      </Link>

      <section aria-labelledby="hosting-heading" className="flex flex-col gap-3">
        <h2 id="hosting-heading" className="text-section font-bold text-text">Hosting</h2>
        <div className="flex flex-col gap-4 rounded-card border border-accent-tint-border bg-linear-to-br from-accent/45 to-accent-tint p-5">
          <p className="text-helper font-medium uppercase tracking-wide text-text-dim">
            {user.isOrganizer ? "Host mode" : "Hosting"}
          </p>
          <p className="text-section font-bold text-text">
            {user.isOrganizer ? "Manage your events and sales" : "Sell tickets to your own events"}
          </p>
          {/* White on the orange gradient, as in the design — its own classes
              rather than a Button variant with overridden colours. */}
          <Link
            href="/host"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-text px-5 text-label font-bold text-ink transition-colors hover:bg-text-dim sm:w-auto sm:self-start"
          >
            {user.isOrganizer ? "Open dashboard" : "Become a host"}
            <ArrowRightIcon width={16} height={16} />
          </Link>
        </div>
      </section>

      <section
        id="details"
        aria-labelledby="profile-heading"
        className="flex scroll-mt-24 flex-col gap-4 rounded-card border border-border bg-surface p-5"
      >
        <h2 id="profile-heading" className="text-section font-bold text-text">Your details</h2>
        <ProfileForm
          user={{
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            kycVerified: user.organizerProfile?.kycStatus === "VERIFIED",
          }}
        />
      </section>
    </Container>
  );
}

async function Wallets({ wallets }: { wallets: ApiWallet[] }) {
  return <WalletCard wallets={await walletViews(wallets)} />;
}

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="text-section font-bold tabular-nums text-text">{value}</span>
      <span className="text-helper text-text-faint">{label}</span>
    </>
  );
  const cls = "flex min-w-0 flex-col items-center gap-1 px-2";
  return href ? (
    <Link href={href} className={`${cls} rounded-control hover:opacity-80`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** `"Jun 2026"`, in Lagos time like every other date on the site. */
function memberSince(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "Africa/Lagos" });
}
