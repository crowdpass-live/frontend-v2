import Image from "next/image";

/**
 * The CrowdPass mascot, named by the state it represents rather than by what
 * it looks like — the name is what maps a pose to a screen.
 *
 * These are the **v2-mobile PNGs**, not the SVGs in the skill's
 * `assets/design/mascots/`. Those SVGs are rasters in SVG clothing with dark
 * captions baked into the artwork (design open issue #13): the caption is
 * unreadable on `#08090D`, and it repeats — badly — the copy already sitting
 * beside it. The mobile team's crops are art-only, so they are the usable set.
 *
 * `no-tickets` is the one exception: that illustration carries no caption, so
 * the skill's SVG is used directly and scales cleanly.
 */
const ART = {
  success: { src: "/mascots/success.png", w: 305, h: 494 },
  error: { src: "/mascots/error.png", w: 198, h: 377 },
  waving: { src: "/mascots/waving.png", w: 304, h: 403 },
  love: { src: "/mascots/love.png", w: 296, h: 427 },
  "lets-go": { src: "/mascots/lets-go.png", w: 397, h: 415 },
  "no-tickets": { src: "/mascots/no-tickets.svg", w: 210, h: 175 },
} as const;

export type MascotPose = keyof typeof ART;

export function Mascot({
  pose,
  height = 160,
  className,
}: {
  pose: MascotPose;
  /** Rendered height in px; width follows the intrinsic ratio. */
  height?: number;
  className?: string;
}) {
  const art = ART[pose];
  return (
    <Image
      src={art.src}
      // Decorative: every place this is used states the same thing in text
      // immediately beside it, and a screen reader announcing "mascot looking
      // pleased" adds nothing but noise.
      alt=""
      aria-hidden
      width={Math.round((art.w / art.h) * height)}
      height={height}
      className={className}
    />
  );
}
