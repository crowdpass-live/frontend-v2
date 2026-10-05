import type { Metadata } from "next";
import { AppShell, type ShellNavSection } from "@/components/app/AppShell";
import { AccountSlot } from "@/components/account/AccountMenu";
import { getCurrentUser } from "@/lib/session";
import { GridIcon, HomeIcon, ScanIcon, TicketIcon, UserIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: { default: "Door", template: "%s · CrowdPass Door" },
  robots: { index: false, follow: false },
};

/**
 * Door chrome. The gate is one level down, inside this group's error.tsx.
 * Check-in staff are often plain buyers, so the host link appears only for
 * organizers; the read swallows errors so this layout never throws.
 */
export default async function DoorGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser().catch(() => undefined);
  const sections: ShellNavSection[] = [
    { items: [{ href: "/door", label: "Your doors", icon: <ScanIcon />, exact: true, also: ["/door/"] }] },
    {
      title: "More",
      items: [
        ...(user?.isOrganizer ? [{ href: "/host", label: "Host dashboard", icon: <GridIcon /> }] : []),
        { href: "/account/tickets", label: "My tickets", icon: <TicketIcon /> },
        { href: "/account", label: "Account", icon: <UserIcon />, exact: true },
        { href: "/", label: "Browse CrowdPass", icon: <HomeIcon />, exact: true },
      ],
    },
  ];

  return (
    <AppShell label="Door" home="/door" sections={sections} account={<AccountSlot />}>
      {children}
    </AppShell>
  );
}
