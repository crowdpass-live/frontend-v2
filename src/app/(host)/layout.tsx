import type { Metadata } from "next";
import { AppShell, type ShellNavSection } from "@/components/app/AppShell";
import { AccountSlot } from "@/components/account/AccountMenu";
import { getCurrentUser } from "@/lib/session";
import { payoutSetup } from "@/lib/payout-setup";
import {
  BankIcon,
  ChartIcon,
  GridIcon,
  HomeIcon,
  LockIcon,
  ScanIcon,
  TicketIcon,
  UserIcon,
  WalletIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: { default: "Host", template: "%s · CrowdPass Host" },
  robots: { index: false, follow: false },
};

/**
 * Organizer chrome. No gate here, on purpose: `error.tsx` beside this file
 * only catches errors from BELOW it, so the gate lives one level down in
 * `host/layout.tsx`, where a cold API lands on the retry screen instead of
 * Next's bare error page. The one read here cannot throw.
 */
export default async function HostGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only to shape the nav: someone who isn't a host yet sees "become a host",
  // and every host link would just lead back to it. Errors are swallowed so
  // this layout still never throws — the gate below it does, inside
  // error.tsx. Cached: the gate's own read reuses this request.
  const user = await getCurrentUser().catch(() => undefined);
  const hosting = user?.isOrganizer !== false;
  // Unknown user (cold API): show the nav without nudges rather than guess.
  const setup = user?.organizerProfile ? payoutSetup(user) : null;

  const sections: ShellNavSection[] = hosting
    ? [
        {
          items: [
            { href: "/host", label: "Dashboard", icon: <GridIcon />, exact: true, also: ["/host/events/"] },
            { href: "/host/payouts", label: "Payouts", icon: <WalletIcon /> },
            { href: "/host/earnings", label: "Earnings", icon: <ChartIcon /> },
          ],
        },
        {
          title: "Get paid",
          items: [
            {
              href: "/host/payout-account",
              label: "Payout account",
              icon: <BankIcon />,
              badge: setup && setup.bank !== "done" ? "To do" : undefined,
            },
            {
              href: "/host/verify",
              label: "Identity",
              icon: <LockIcon />,
              badge: setup && setup.identity === "todo" ? "To do" : undefined,
            },
          ],
        },
        {
          title: "More",
          items: [
            { href: "/door", label: "At the door", icon: <ScanIcon /> },
            { href: "/account/tickets", label: "My tickets", icon: <TicketIcon /> },
            { href: "/account", label: "Account", icon: <UserIcon />, exact: true },
            { href: "/", label: "Browse CrowdPass", icon: <HomeIcon />, exact: true },
          ],
        },
      ]
    : [];

  return (
    <AppShell
      label="Host"
      home="/host"
      sections={sections}
      action={hosting ? { href: "/host/events/new", label: "Create event" } : undefined}
      account={<AccountSlot />}
    >
      {children}
    </AppShell>
  );
}
