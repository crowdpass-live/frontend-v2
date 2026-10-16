import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { fetchUpcomingEvents } from "@/lib/crowdpass";
import { EventCard } from "@/components/EventCards";
import { EventCardSkeleton } from "@/components/Skeleton";
import { PassPreview } from "@/components/landing/PassPreview";
import { HowItWorks, SpeechBubble } from "@/components/landing/HowItWorks";
import { Partners } from "@/components/landing/Partners";
import { PlatformStats, PlatformStatsSkeleton } from "@/components/landing/PlatformStats";
import { Mascot } from "@/components/Mascot";
import { ButtonLink, Container } from "@/components/ui";
import {
  ArrowRightIcon,
  CardIcon,
  CheckIcon,
  ScanIcon,
  TicketIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: { absolute: "CrowdPass — Events. Tickets. Verified." },
  description:
    "Find what's on across Nigeria, pay in naira in under a minute, and walk in with a ticket that can't be faked. No account needed.",
};

/**
 * Discover lived at `/` before this page did, and its filtered views were
 * shared as `/?category=PARTY` and the like — in WhatsApp groups, on flyers.
 * Those links still have to land on the list they meant.
 */
const DISCOVER_PARAMS = ["search", "category", "location", "page"];

type SearchParams = Record<string, string | string[] | undefined>;

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  if (DISCOVER_PARAMS.some((k) => params[k] !== undefined)) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const value = Array.isArray(v) ? v[0] : v;
      if (value) qs.set(k, value);
    }
    redirect(`/events?${qs}`);
  }

  return (
    <main className="flex flex-1 flex-col">
      <Hero />
      {/* Straight under the hero: the claim, then the proof. */}
      <Suspense fallback={<PlatformStatsSkeleton />}>
        <PlatformStats />
      </Suspense>
      <Upcoming />
      <PartnersStrip />
      <Walkthrough />
      <TicketPromise />
      <ForHosts />
      <Closing />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

/** `--rise-delay` for the staggered entrance (see `.rise-in`). */
const delay = (ms: number) => ({ "--rise-delay": `${ms}ms` }) as CSSProperties;

function Hero() {
  return (
    // `overflow-hidden` contains the pass's glow and tilted back card, which
    // would otherwise push a 320px viewport sideways.
    <section className="relative isolate overflow-hidden">
      <div className="stage-light absolute inset-0 -z-10" aria-hidden />

      <Container
        size="page"
        className="grid grid-cols-1 items-center gap-16 pb-14 pt-12 sm:pt-16 lg:grid-cols-[1.2fr_1fr] lg:gap-12 lg:pb-20 lg:pt-24"
      >
        <div className="flex flex-col items-start gap-6 lg:gap-8">
          <span
            className="rise-in inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-helper font-medium text-text-dim"
            style={delay(0)}
          >
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            Events · Tickets · Verified
          </span>

          <h1
            className="rise-in text-[2.5rem] font-bold leading-[1.05] tracking-tight text-text text-balance sm:text-6xl lg:text-7xl"
            style={delay(80)}
          >
            Your next event, <span className="text-accent">one tap away.</span>
          </h1>

          <p
            className="rise-in max-w-xl text-body text-text-dim sm:text-section"
            style={delay(160)}
          >
            Find what&apos;s on across Nigeria, pay in naira in under a minute,
            and walk in with a ticket that can&apos;t be copied or faked. No
            account needed.
          </p>

          <div
            className="rise-in flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
            style={delay(240)}
          >
            <ButtonLink href="/events" className="w-full sm:w-auto">
              Explore events
              <ArrowRightIcon width={18} height={18} />
            </ButtonLink>
            <ButtonLink href="/host" variant="secondary" className="w-full sm:w-auto">
              Host an event
            </ButtonLink>
          </div>
        </div>

        <HeroVisual />
      </Container>
    </section>
  );
}

/**
 * The pass, with the mascot stepping out in front of it. The mascot *is* a
 * ticket stub, so it introduces itself as one — the first thing a visitor
 * learns about the character is what it stands for.
 */
function HeroVisual() {
  return (
    <div className="rise-in relative px-6 sm:px-0 sm:pb-4" style={delay(200)}>
      <PassPreview className="sm:pl-16 lg:pl-20" />
      {/* On a phone the pass fills the width, so the mascot stands below it
       * with the bubble beside it — overlapping there would cover the QR.
       * From `sm` the pass leaves room on its left and the mascot steps in
       * front of its corner. */}
      <div className="relative mt-6 flex items-end gap-3 sm:absolute sm:-bottom-6 sm:left-0 sm:mt-0 sm:flex-col sm:items-start sm:gap-0 lg:-left-10">
        <SpeechBubble className="relative order-2 mb-10 sm:order-none sm:mb-2.5 sm:ml-1">
          Hi! I&apos;m your ticket.
        </SpeechBubble>
        <div className="mascot-bob">
          <Mascot pose="waving" height={150} className="mascot-sticker h-auto w-[72px] sm:w-[92px] lg:w-[104px]" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upcoming — the live part of the page
// ---------------------------------------------------------------------------

function SectionHead({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-2xl flex-col gap-3">
        <span className="text-helper font-bold uppercase tracking-[0.18em] text-accent">
          {eyebrow}
        </span>
        <h2 className="text-title font-bold tracking-tight text-text text-balance sm:text-4xl">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function Upcoming() {
  return (
    <section className="reveal border-t border-border/60 py-16 lg:py-24">
      <Container size="page" className="flex flex-col gap-8 lg:gap-12">
        <SectionHead
          eyebrow="Happening soon"
          title="What's on next"
          action={
            <Link
              href="/events"
              className="inline-flex min-h-10 items-center gap-2 text-body font-bold text-accent hover:text-accent-hi"
            >
              See all events
              <ArrowRightIcon width={18} height={18} />
            </Link>
          }
        />
        <Suspense fallback={<UpcomingSkeleton />}>
          <UpcomingList />
        </Suspense>
      </Container>
    </section>
  );
}

/** Numbered, like a running order. Six fills the 3-col grid twice. */
async function UpcomingList() {
  const events = await fetchUpcomingEvents({ limit: 6 })
    .then((r) => r.events)
    .catch(() => null);

  // A landing page doesn't apologise for a cold backend: the section heading
  // and its "See all events" link still stand, and Discover has its own
  // error state.
  if (!events) return null;

  if (events.length === 0) {
    return (
      <div className="flex items-center gap-5 rounded-card border border-border bg-surface p-6 sm:gap-8 sm:p-8">
        <Mascot pose="thinking" height={90} className="mascot-sticker h-auto w-[40px] shrink-0 sm:w-[48px]" />
        <p className="text-body text-text-dim">
          <span className="block font-bold text-text">Hmm, quiet right now.</span>
          Nothing on the calendar this minute. New events land every week, so
          check back soon.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-border sm:grid sm:grid-cols-2 sm:gap-x-5 sm:gap-y-8 sm:divide-y-0 lg:grid-cols-3">
      {events.map((event, i) => (
        <li key={event.id} className="flex items-center gap-3 sm:flex-col sm:items-stretch">
          <span className="w-6 shrink-0 font-mono text-helper text-text-faint sm:w-auto">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <EventCard event={event} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function UpcomingSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3" aria-busy>
      {[0, 1, 2].map((i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The promise — why a buyer should trust this ticket
// ---------------------------------------------------------------------------

const PROMISES = [
  {
    icon: ScanIcon,
    title: "It can't be faked",
    body: "Every ticket is a signed code, minted on-chain, and each one scans once. A screenshot of someone else's gets turned away at the door.",
  },
  {
    icon: CardIcon,
    title: "Pay the way you already do",
    body: "Card, bank transfer or USSD, in naira. Or pay in crypto if that's more your thing. Checkout takes under a minute.",
  },
  {
    icon: TicketIcon,
    title: "No account, no app",
    body: "Check out as a guest with your email. Your ticket arrives in your inbox and opens in any browser at the gate.",
  },
] as const;

function TicketPromise() {
  return (
    <section className="reveal border-t border-border/60 py-16 lg:py-24">
      <Container size="page" className="flex flex-col gap-10 lg:gap-14">
        <SectionHead
          eyebrow="The ticket"
          title={
            <>
              A ticket that holds up <span className="text-text-dim">at the door.</span>
            </>
          }
        />
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-border bg-border md:grid-cols-3">
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-4 bg-bg p-6 lg:p-8">
              <span className="inline-flex size-11 items-center justify-center rounded-xl border border-accent-tint-border bg-accent-tint text-accent">
                <Icon width={22} height={22} />
              </span>
              <h3 className="text-section font-bold text-text">{title}</h3>
              <p className="text-body text-text-dim">{body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Partners & integrations
// ---------------------------------------------------------------------------

function PartnersStrip() {
  return (
    <section className="reveal border-t border-border/60 py-16 lg:py-24">
      <Container size="page" className="flex flex-col gap-3 text-center">
        <span className="text-helper font-bold uppercase tracking-[0.18em] text-accent">
          Partners &amp; integrations
        </span>
        <h2 className="mx-auto max-w-2xl text-title font-bold tracking-tight text-text text-balance sm:text-4xl">
          Built on infrastructure you already trust.
        </h2>
        <p className="mx-auto max-w-xl text-body text-text-dim">
          Your money, your identity and your ticket move through names you
          know, from the first tap to the scan at the door.
        </p>
      </Container>
      {/* Full-bleed, outside the container: a marquee boxed into 1152px
       * looks like a carousel that broke. */}
      <div className="mt-10 lg:mt-14">
        <Partners />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How it works — the mascot walks the ticket to the door
// ---------------------------------------------------------------------------

function Walkthrough() {
  return (
    <section className="border-t border-border/60 py-16 lg:py-28">
      <Container size="page" className="flex flex-col gap-12 lg:gap-20">
        <div className="reveal flex flex-col gap-3">
          <span className="text-helper font-bold uppercase tracking-[0.18em] text-accent">
            How it works
          </span>
          <h2 className="max-w-2xl text-title font-bold tracking-tight text-text text-balance sm:text-4xl">
            Follow the ticket, from &ldquo;what&apos;s on?&rdquo; to &ldquo;I&apos;m in.&rdquo;
          </h2>
          <p className="max-w-xl text-body text-text-dim sm:text-section sm:leading-7">
            Four steps, about a minute of your time, and no app to download.
            Our little ticket will show you around.
          </p>
        </div>
        <HowItWorks />
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// For hosts
// ---------------------------------------------------------------------------

const HOST_FEATURES = [
  "Ticket tiers, sales windows and a cover that sells the night",
  "A check-in team: anyone you trust scans from their own phone",
  "Sales and attendees, live, as the night fills up",
  "Revenue sharing with co-hosts, and payouts to your bank",
];

function ForHosts() {
  return (
    <section className="reveal border-t border-border/60 py-16 lg:py-24">
      <Container size="page">
        <div className="relative isolate overflow-hidden rounded-card border border-border bg-surface">
          {/* One soft wash of brand colour from the corner the mascot sits
           * in — enough to warm the panel, not enough to shout. */}
          <div
            className="absolute -right-24 -top-24 -z-10 size-96 rounded-full bg-accent/15 blur-3xl"
            aria-hidden
          />
          <div className="grid grid-cols-1 items-end gap-8 p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:p-14">
            <div className="flex flex-col items-start gap-6">
              <span className="text-helper font-bold uppercase tracking-[0.18em] text-accent">
                For hosts
              </span>
              <h2 className="text-title font-bold tracking-tight text-text text-balance sm:text-4xl">
                Create, sell and run the door, from one place.
              </h2>
              <ul className="flex flex-col gap-3">
                {HOST_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-body text-text-dim">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                      <CheckIcon width={14} height={14} />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <ButtonLink href="/host" className="mt-2 w-full sm:w-auto">
                Start hosting
                <ArrowRightIcon width={18} height={18} />
              </ButtonLink>
            </div>
            {/* Hidden on a phone: there the panel is already a tall column,
             * and a 200px illustration under the button pushes the next
             * section a screen further away. */}
            <div className="hidden justify-center lg:flex">
              <div className="mascot-bob">
                <Mascot pose="lets-go" height={180} className="mascot-sticker" />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Closing
// ---------------------------------------------------------------------------

function Closing() {
  return (
    <section className="reveal relative isolate overflow-hidden border-t border-border/60 py-20 lg:py-32">
      <div className="stage-light absolute inset-0 -z-10 rotate-180" aria-hidden />
      <Container size="page" className="flex flex-col items-center gap-6 text-center">
        <div className="mascot-bob">
          <Mascot pose="love" height={110} className="mascot-sticker h-auto w-[64px] sm:w-[72px]" />
        </div>
        <h2 className="max-w-3xl text-[2.25rem] font-bold leading-[1.1] tracking-tight text-text text-balance sm:text-5xl lg:text-6xl">
          Real events. Real people. <span className="text-accent">Real tickets.</span>
        </h2>
        <p className="max-w-md text-body text-text-dim">
          Your ticket is a few taps from here.
        </p>
        <ButtonLink href="/events" className="w-full sm:w-auto">
          Explore events
          <ArrowRightIcon width={18} height={18} />
        </ButtonLink>
      </Container>
    </section>
  );
}
