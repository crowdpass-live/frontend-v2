import { ButtonLink, Container } from "@/components/ui";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Mascot } from "@/components/Mascot";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center py-24">
      <Container className="flex flex-col items-center gap-6 text-center">
        <Mascot pose="error" height={160} />
        <p className="text-display font-bold text-text">Not found</p>
        <p className="text-body text-text-dim text-balance">
          This event or ticket doesn&apos;t exist, or it&apos;s no longer
          published. Check the link you were sent.
        </p>
        <ButtonLink href="/" variant="secondary" className="min-w-[200px]">
          Back to CrowdPass
        </ButtonLink>
      </Container>
      </main>
      <SiteFooter />
    </>
  );
}
