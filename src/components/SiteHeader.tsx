import Link from "next/link";
import { Container } from "./ui";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      Crowd<span className="text-accent">Pass</span>
    </span>
  );
}

/**
 * The site bar.
 *
 * Mobile had no header at all — the app-like screens carried their own back
 * buttons and that was enough. On a desktop browser a page with no chrome
 * reads as broken, and there is nothing to click to get home from a shared
 * event link.
 *
 * Sticky, with a translucent background: on the event page it sits over a
 * full-bleed cover, so an opaque bar would cut a hard line across the image.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/80 backdrop-blur-md">
      <Container size="page" className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="text-section font-bold tracking-tight text-text"
          aria-label="CrowdPass home"
        >
          <Wordmark />
        </Link>

        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className="rounded-full px-4 py-2 text-label font-medium text-text-dim transition-colors hover:bg-surface hover:text-text"
          >
            Browse events
          </Link>
        </nav>
      </Container>
    </header>
  );
}
