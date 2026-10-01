import { requireUser } from "@/lib/session";
import { serverFetch } from "@/lib/api-server";
import { settle } from "@/lib/organizer";
import { BecomeHost } from "@/components/host/BecomeHost";
import type { ApiOrganizerCountry } from "@/types/api";

/** If the country list can't be read, Nigeria is the only supported one. */
const FALLBACK_COUNTRIES: ApiOrganizerCountry[] = [
  { code: "NG", name: "Nigeria", currency: "NGN", kycIdTypes: ["BVN", "NIN"] },
];

/**
 * The `(host)` gate: a session (the proxy already checked the cookie) and
 * `isOrganizer`. A signed-in non-organizer gets "become a host" (#32) —
 * one step, right here — never a 403 wall.
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
  if (user.isOrganizer) return <>{children}</>;

  // `GET /organizer/countries` is auth-only, no @Roles — a buyer may read it.
  const countries = await settle(serverFetch<ApiOrganizerCountry[]>("/organizer/countries"));
  return (
    <BecomeHost
      user={{ firstName: user.firstName, lastName: user.lastName, email: user.email }}
      countries={countries.ok && countries.value.length ? countries.value : FALLBACK_COUNTRIES}
    />
  );
}
