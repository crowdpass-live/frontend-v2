import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { AccountSlot } from "@/components/account/AccountMenu";

export const metadata: Metadata = {
  title: { default: "Door", template: "%s · CrowdPass Door" },
  robots: { index: false, follow: false },
};

/** Door chrome. The gate is one level down, inside this group's error.tsx. */
export default function DoorGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell label="Door" home="/door" account={<AccountSlot />}>
      {children}
    </AppShell>
  );
}
