import type { CSSProperties, ReactNode } from "react";
import { Mascot, type MascotPose } from "../Mascot";
import { CheckIcon } from "../icons";
import { cx } from "../ui";

/**
 * The landing page's walkthrough, told by the mascot.
 *
 * The mascot is a ticket stub, so it plays the buyer's ticket through the
 * whole journey — curious, then paid, then in hand, then through the door.
 * Each stage uses the pose the design maps to that state (thinking = looking,
 * success = purchase confirmed, got-ticket = ticket issued, vip = in), so the
 * character a buyer meets here is the same one they meet at checkout and on
 * their ticket. That repetition is the point: it's how the mascot becomes
 * *the* CrowdPass face.
 *
 * Every claim below is something the product does today. Keep it that way —
 * a walkthrough that promises a feature the checkout doesn't have is worse
 * than a shorter one.
 */
const STAGES: {
  pose: MascotPose;
  height: number;
  says: string;
  title: string;
  body: string;
  details: string[];
}[] = [
  {
    pose: "thinking",
    height: 150,
    says: "Hmm… what's on this weekend?",
    title: "Find your night",
    body: "Browse what's on across Nigeria: parties, concerts, conferences, workshops. Every event shows the venue, the time and each ticket tier's price before you tap anything.",
    details: ["Search by name, filter by city or vibe", "Prices up front, in naira"],
  },
  {
    pose: "success",
    // Taller than the rest: the confetti and ticket around this pose take
    // up its frame, so at 150 the body itself reads smaller than its siblings.
    height: 185,
    says: "Paid. That was quick!",
    title: "Pay in under a minute",
    body: "Pick a tier and how many, add your name and email, and pay by card, bank transfer or USSD. No account, no password, no app to install.",
    details: [
      "A bank transfer can take a few minutes to confirm. We keep checking for you",
      "Some events take crypto too",
    ],
  },
  {
    pose: "got-ticket",
    height: 150,
    says: "Got it, straight to my inbox.",
    title: "Your ticket lands",
    body: "Your ticket is minted on-chain and emailed to you with a signed QR code. It opens in any browser, and lives at its own link you can come back to.",
    details: ["Download it or share it to WhatsApp", "One ticket, one owner: it can't be copied"],
  },
  {
    pose: "vip",
    height: 150,
    says: "Straight through. VIP vibes.",
    title: "Walk right in",
    body: "At the gate, the host's team scans your QR. It's checked and marked used in a second, so the ticket on your phone is the only one that gets in.",
    details: ["Phone dead? Your ticket reference works at the door too"],
  },
];

export function HowItWorks() {
  return (
    <ol className="flex flex-col gap-16 lg:gap-24">
      {STAGES.map((stage, i) => (
        <Stage key={stage.title} index={i} {...stage} />
      ))}
    </ol>
  );
}

function Stage({
  index,
  pose,
  height,
  says,
  title,
  body,
  details,
}: (typeof STAGES)[number] & { index: number }) {
  // Zig-zag on a desktop: the stage swaps sides each step, so the eye walks
  // down the page the way the ticket walks to the door. One element moved by
  // `order`, never two copies.
  const flip = index % 2 === 1;

  return (
    // The stage takes the narrower column: the copy is what explains, the
    // mascot is the accent.
    <li
      className={cx(
        "reveal grid grid-cols-1 items-center gap-8 lg:gap-16",
        flip ? "lg:grid-cols-[7fr_5fr]" : "lg:grid-cols-[5fr_7fr]",
      )}
    >
      <div className={cx("relative mx-auto w-full max-w-md lg:max-w-none", flip && "lg:order-2")}>
        <MascotStage pose={pose} height={height} says={says} delay={index * 600} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-label font-bold text-accent">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="h-px w-10 bg-accent/50" aria-hidden />
          <span className="text-helper font-bold uppercase tracking-[0.18em] text-text-faint">
            Step {index + 1} of {STAGES.length}
          </span>
        </div>
        <h3 className="text-title font-bold tracking-tight text-text sm:text-3xl">{title}</h3>
        <p className="max-w-lg text-body text-text-dim sm:text-section sm:leading-7">{body}</p>
        <ul className="mt-1 flex flex-col gap-2.5">
          {details.map((d) => (
            <li key={d} className="flex items-start gap-3 text-label text-text-dim sm:text-body">
              <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <CheckIcon width={13} height={13} />
              </span>
              {d}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

/**
 * The mascot on a lit stage with something to say. The speech bubble is live
 * text (the art's own captions are black-on-transparent and cropped off), so
 * it reads on dark and can change without new artwork.
 */
export function MascotStage({
  pose,
  height,
  says,
  delay = 0,
  className,
}: {
  pose: MascotPose;
  height: number;
  says: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cx(
        // The mascot sits right of centre, clear of the bubble in the top
        // left, and small enough that the stage reads as a vignette rather
        // than a poster.
        "relative isolate flex aspect-[4/3] items-end justify-center overflow-hidden rounded-card border border-border bg-surface pb-6 pl-[28%] sm:pb-7",
        className,
      )}
    >
      {/* Spotlight from above and a pool of light on the floor. */}
      <div className="absolute inset-x-0 top-0 -z-10 h-full bg-gradient-to-b from-accent/15 via-accent/5 to-transparent" aria-hidden />
      <div className="absolute bottom-4 left-1/2 -z-10 h-10 w-2/3 -translate-x-1/2 rounded-full bg-accent/25 blur-2xl" aria-hidden />

      <SpeechBubble className="absolute left-5 top-5 z-10 max-w-[58%] sm:left-6 sm:top-6">{says}</SpeechBubble>

      <div className="mascot-bob" style={{ "--bob-delay": `${delay}ms` } as CSSProperties}>
        <Mascot pose={pose} height={height} className="mascot-sticker h-auto max-h-[38vw] w-auto sm:max-h-none" />
      </div>
    </div>
  );
}

export function SpeechBubble({
  children,
  className,
  tail = "left",
}: {
  children: ReactNode;
  className?: string;
  tail?: "left" | "right";
}) {
  return (
    <span
      className={cx(
        "inline-block rounded-2xl bg-text px-3.5 py-2 text-helper font-bold text-ink shadow-lg shadow-black/40 sm:text-label",
        className,
      )}
    >
      {children}
      <span
        aria-hidden
        className={cx(
          "absolute -bottom-1.5 size-3 rotate-45 bg-text",
          tail === "left" ? "left-7" : "right-7",
        )}
      />
    </span>
  );
}
