import { requireUser } from "@/lib/session";

/** The `(account)` gate: any valid session. */
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <>{children}</>;
}
