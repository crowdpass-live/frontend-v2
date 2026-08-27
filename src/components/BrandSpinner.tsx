import { cx } from "./ui";
import { MARK_BLOCKS, MARK_DOOR, MARK_VIEWBOX } from "./BrandMark";

/**
 * The CrowdPass mark as a loading indicator.
 *
 * A direct port of `v2-mobile/src/components/BrandSpinner.js`, down to the
 * timings, so a wait looks the same on both surfaces. Nothing spins on the
 * spot: the six blocks breathe in sequence around a fixed door, so a wait
 * reads as the brand rather than as the platform.
 *
 * Choreography (from mobile, where it is an `Animated.loop` of an
 * `Animated.stagger`): each block lifts over 300ms and settles over 520ms,
 * starts are staggered 130ms apart, and the whole sequence loops. The last
 * block therefore finishes at 5×130 + 820 = 1470ms, which is the cycle length
 * — expressing it as one keyframe of that duration per block, offset by
 * `animation-delay`, keeps the phase stable however long the wait runs.
 *
 * The door holds still. It is the part that reads as CrowdPass, and pulsing it
 * too turns the whole mark into noise.
 */

/** Dim, not gone — the mark stays legible as a mark throughout. */
const CYCLE_MS = 1470;
const STAGGER_MS = 130;

export function BrandSpinner({
  width = 96,
  label = "Loading",
  className,
}: {
  width?: number;
  /** Announced to screen readers; the visual is decorative. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cx("inline-block text-accent", className)}
      style={{ width, height: (width * MARK_VIEWBOX.h) / MARK_VIEWBOX.w }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${MARK_VIEWBOX.w} ${MARK_VIEWBOX.h}`}
        fill="currentColor"
        aria-hidden
      >
        {MARK_BLOCKS.map((b, i) => (
          <rect
            key={b.key}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            className="brand-pulse"
            style={{
              animationDuration: `${CYCLE_MS}ms`,
              animationDelay: `${i * STAGGER_MS}ms`,
            }}
          />
        ))}
        <path d={MARK_DOOR} />
      </svg>
    </span>
  );
}
