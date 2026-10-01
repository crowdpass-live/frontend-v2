import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { AccountSlot } from "@/components/account/AccountMenu";
import { getCurrentUser } from "@/lib/session";

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
  // Only to hide the nav from someone who isn't a host yet (they see "become
  // a host", and Payouts/Earnings would just lead back to it). Errors are
  // swallowed so this layout still never throws — the gate below it does,
  // inside error.tsx. Cached: the gate's own read reuses this request.
  const user = await getCurrentUser().catch(() => undefined);
  const hosting = user?.isOrganizer !== false;
  return (
    <AppShell
      label="Host"
      home="/host"
      nav={
        hosting
          ? [
              { href: "/host", label: "Dashboard", also: ["/host/events/"] },
              { href: "/host/payouts", label: "Payouts" },
              { href: "/host/earnings", label: "Earnings" },
            ]
          : []
      }
      account={<AccountSlot />}
    >
      {children}
    </AppShell>
  );
}
