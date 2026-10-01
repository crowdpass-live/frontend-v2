import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: { default: "Account", template: "%s · CrowdPass" },
  robots: { index: false, follow: false },
};

/**
 * Attendee account chrome — the storefront's, since an attendee is still a
 * buyer. The gate is in `account/layout.tsx`, below this group's error.tsx.
 */
export default function AccountGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
