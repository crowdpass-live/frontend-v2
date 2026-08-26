import { Container } from "./ui";
import { Wordmark } from "./SiteHeader";

/**
 * Deliberately thin. There is no marketing site here to link into, and
 * inventing About / Careers / Press links that 404 is worse than a quiet
 * footer.
 *
 * `mt-auto` plus the `flex-1` on each page's `<main>` keeps it at the bottom
 * of short pages (a 404, an empty search) instead of floating mid-screen.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60">
      <Container
        size="page"
        className="flex flex-col gap-2 py-8 sm:flex-row sm:items-center sm:justify-between"
      >
        <Wordmark className="text-label font-bold text-text-dim" />
        <p className="text-helper text-text-faint">
          Tickets minted on-chain. Built for Nigeria.
        </p>
      </Container>
    </footer>
  );
}
