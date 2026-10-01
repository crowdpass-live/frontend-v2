import { Mascot } from "@/components/Mascot";
import { ButtonLink, Container } from "@/components/ui";

/**
 * What a signed-in non-organizer sees at `/host`.
 *
 * Becoming a host (Phase 4: profile, KYC, payout account) is not on the web
 * yet, so this points at the app rather than at a form that does not exist.
 */
export function NotAHost({ name }: { name: string }) {
  return (
    <Container className="flex flex-col items-center gap-5 py-24 text-center">
      <Mascot pose="lets-go" height={130} />
      <h1 className="text-title font-bold text-text">Host your own events</h1>
      <p className="text-body text-text-dim">
        {name ? `${name}, your` : "Your"} account isn&apos;t set up for hosting
        yet. Becoming a host — verifying your identity and connecting a payout
        account — happens in the CrowdPass app for now. Once that&apos;s done,
        sign in here to run your events from a bigger screen.
      </p>
      <ButtonLink href="/" variant="secondary" className="w-full sm:w-auto">
        Browse events
      </ButtonLink>
    </Container>
  );
}
