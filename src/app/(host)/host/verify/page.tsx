import type { Metadata } from "next";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { fetchKycStatus } from "@/lib/organizer";
import { isProvisionalName } from "@/lib/names";
import { VerifyIdentity } from "@/components/host/VerifyIdentity";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Verify your identity" };

/**
 * Identity verification (#33) — the step between "host mode is on" and a
 * bank account. Status comes from `GET /organizer/kyc`, which is also where
 * any verdict is read from; the form itself is client-side.
 */
export default async function VerifyIdentityPage() {
  const user = await requireUser();

  let kyc;
  try {
    kyc = await fetchKycStatus();
  } catch (err) {
    // ADMIN passes the (host) gate but the route is @Roles(ORGANIZER).
    if (err instanceof ApiError && err.status === 403) return <OrganizersOnly />;
    throw err;
  }

  return (
    <VerifyIdentity
      initial={kyc}
      user={{
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        provisionalName: isProvisionalName(user),
      }}
    />
  );
}

function OrganizersOnly() {
  return (
    <Container className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-title font-bold text-text">Organizer accounts only</h1>
      <p className="text-body text-text-dim">
        Identity verification is for organizers taking card and bank payments.{" "}
        <Link href="/host" className="font-bold text-accent hover:text-accent-hi">
          Back to the dashboard
        </Link>
        .
      </p>
    </Container>
  );
}
