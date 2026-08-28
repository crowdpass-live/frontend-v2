import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · CrowdPass Admin" },
  // Never indexed, and no referrer: these URLs should not leak into analytics
  // on any site a link happens to be pasted into.
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
