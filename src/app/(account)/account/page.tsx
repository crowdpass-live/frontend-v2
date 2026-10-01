import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { ProfileForm } from "@/components/account/ProfileForm";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Account" };

/**
 * The attendee account page. For now: your details (#27). My tickets (#25)
 * and the wallet card (#26) join it in Phase 2.
 */
export default async function AccountPage() {
  const user = await requireUser();
  return (
    <Container className="flex flex-col gap-6 py-10">
      <div>
        <h1 className="text-title font-bold text-text">Your account</h1>
        <p className="mt-1 text-body text-text-dim">Your details, as CrowdPass knows them.</p>
      </div>
      <section aria-labelledby="profile-heading" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5">
        <h2 id="profile-heading" className="text-section font-bold text-text">Your details</h2>
        <ProfileForm
          user={{
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            kycVerified: user.organizerProfile?.kycStatus === "VERIFIED",
          }}
        />
      </section>
    </Container>
  );
}
