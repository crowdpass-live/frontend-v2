import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · CrowdPass Admin" },
  // Never indexed, and no referrer: these URLs should not leak into analytics
  // on any site a link happens to be pasted into.
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `undefined` = could not ask. The status page exists for incidents, when
  // the API may be cold or down; it must still render rather than fail on
  // the courtesy role check. The panels then report their own errors.
  const user = await getCurrentUser().catch(() => undefined);
  return <AdminShell user={user}>{children}</AdminShell>;
}
