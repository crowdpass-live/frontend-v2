import { Container } from "./ui";
import { Logo } from "./Logo";

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
        className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between"
      >
        <Logo variant="full" height={20} className="opacity-60" />
        <p className="text-helper text-text-faint">
          Tickets minted on-chain. Built for Nigeria.
        </p>
      </Container>
    </footer>
  );
}
