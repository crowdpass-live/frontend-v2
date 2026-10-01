import { requireUser } from "@/lib/session";
import { NotAHost } from "./NotAHost";

/**
 * The `(host)` gate: a session (the proxy already checked the cookie) and
 * `isOrganizer`. A signed-in BUYER gets an explainer, never a 403 wall.
 *
 * Not a security boundary — a page renders in parallel with its layout, so
 * pages here must still assume nothing: every organizer route on the API is
 * `@Roles(ORGANIZER, ADMIN)` plus an ownership check, and that is the gate.
 */
export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!user.isOrganizer) return <NotAHost name={user.firstName || user.name} />;
  return <>{children}</>;
}
