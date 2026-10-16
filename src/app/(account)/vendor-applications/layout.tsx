import { requireUser } from "@/lib/session";

/**
 * A vendor's own applications: any valid session. Kept at
 * `/vendor-applications/:id` rather than under `/account` because that is the
 * URL the backend's vendor emails link to.
 */
export default async function VendorApplicationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <>{children}</>;
}
