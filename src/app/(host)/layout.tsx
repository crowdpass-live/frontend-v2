import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { AccountSlot } from "@/components/account/AccountMenu";

export const metadata: Metadata = {
  title: { default: "Host", template: "%s · CrowdPass Host" },
  robots: { index: false, follow: false },
};

/**
 * Organizer chrome. No data and no gate here, on purpose: `error.tsx` beside
 * this file only catches errors from BELOW it, so the gate lives one level
 * down in `host/layout.tsx`, where a cold API lands on the retry screen
 * instead of Next's bare error page.
 */
export default function HostGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell
      label="Host"
      home="/host"
      nav={[
        { href: "/host", label: "Dashboard", also: ["/host/events/"] },
        { href: "/host/payouts", label: "Payouts" },
        { href: "/host/earnings", label: "Earnings" },
      ]}
      account={<AccountSlot />}
    >
      {children}
    </AppShell>
  );
}
