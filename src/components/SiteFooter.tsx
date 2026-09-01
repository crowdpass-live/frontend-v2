import Link from "next/link";
import { Container } from "./ui";
import { Logo } from "./Logo";
import { BUSINESS } from "@/lib/business";

/**
 * Still deliberately thin. Every link here goes to a page that exists —
 * there is no marketing site to link into, and inventing About / Careers /
 * Press links that 404 is worse than a quiet footer.
 *
 * What it carries is the business's contact details and the policy pages.
 * Those are a requirement of the payment processor rather than a design
 * choice, and the footer is the one piece of chrome on every buyer-facing
 * page, so they are reachable from checkout and from a ticket without a hunt.
 *
 * `mt-auto` plus the `flex-1` on each page's `<main>` keeps it at the bottom
 * of short pages (a 404, an empty search) instead of floating mid-screen.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60">
      <Container
        size="page"
        className="flex flex-col gap-6 py-8 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="flex flex-col gap-3">
          <Logo variant="full" height={20} className="opacity-60" />
          <p className="text-helper text-text-faint">
            Tickets minted on-chain. Built for Nigeria.
          </p>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-helper text-text-faint">
            {[
              { href: "/contact", label: "Contact us" },
              { href: "/terms", label: "Terms of service" },
              { href: "/privacy", label: "Privacy policy" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-text"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* `<address>` is the right element for the contact details of the
         * page's owner, and it is italic by default in every browser —
         * `not-italic` puts it back in step with the rest of the type. */}
        <address className="flex flex-col gap-1 not-italic text-helper text-text-faint sm:items-end sm:text-right">
          <a
            href={`mailto:${BUSINESS.email}`}
            className="transition-colors hover:text-text"
          >
            {BUSINESS.email}
          </a>
          {/* A phone number on a phone should dial. */}
          <a
            href={`tel:${BUSINESS.phone.href}`}
            className="transition-colors hover:text-text"
          >
            {BUSINESS.phone.display}
          </a>
          <span className="mt-1">
            {/* The registered name, not the brand: the processor's compliance
             * review looks for the entity it holds the merchant account with. */}
            <span className="block text-text-dim">{BUSINESS.legalName}</span>
            {BUSINESS.address.lines.map((line) => (
              // The address stays on its own lines rather than one wrapped
              // run: a comma-joined address breaking mid-street is hard to
              // read back to a courier or a bank.
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </span>
        </address>
      </Container>
    </footer>
  );
}
