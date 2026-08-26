import { ButtonLink, Shell } from "@/components/ui";

/**
 * Placeholder home.
 *
 * Browse/discover is deliberately out of scope for this build — buyers reach
 * an event through a shared `/events/[slug]` link, a WhatsApp message or a
 * flyer QR. This exists so those routes have a sane parent and a buyer who
 * trims the URL back doesn't hit a 404.
 */
export default function HomePage() {
  return (
    <main className="flex flex-1 items-center justify-center py-24">
      <Shell className="flex flex-col items-center gap-6 text-center">
        <p className="text-display font-bold tracking-tight text-text">
          Crowd<span className="text-accent">Pass</span>
        </p>
        <p className="text-body text-text-dim text-balance">
          Tickets for the events you actually want to be at. Open the link
          you were sent to get yours.
        </p>
        <ButtonLink
          href="https://crowdpass.ng"
          variant="secondary"
          className="min-w-[200px]"
        >
          Learn more
        </ButtonLink>
      </Shell>
    </main>
  );
}
