/**
 * How the prize wheel moves, as plain functions of time so the motion can be
 * reasoned about (and tested) apart from React.
 *
 * Modelled on a real carnival wheel rather than a single CSS curve:
 *
 *  1. Wind-up: the hand pulls it back a few degrees.
 *  2. Release: it leaves at speed and slows on an ease-out-cubic curve. Peak
 *     speed is kept under ~16° a frame: much faster and the eye sees the
 *     slices strobe instead of turn. Cubic rather than quartic, so the last
 *     slices still visibly tick past instead of crawling for seconds.
 *  3. Settle: it rolls just past the stop and the flapper eases it back.
 *
 * The pointer is not on a timer. It is driven by the wheel's actual angle:
 * as each slice edge reaches it, the peg pushes it aside and it springs back.
 * Fast clicks at speed, slow single ticks at the end.
 */

export const WIND_MS = 380;
export const MAIN_MS = 6200;
export const SETTLE_MS = 520;
export const SPIN_TOTAL_MS = WIND_MS + MAIN_MS + SETTLE_MS;

const WIND_DEG = 10;
const OVERSHOOT_DEG = 2.4;

const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

/** The wheel's angle (degrees, clockwise) `t` ms into a spin from `from` to `to`. */
export function angleAt(from: number, to: number, t: number): number {
  if (t <= 0) return from;
  if (t < WIND_MS) return from - WIND_DEG * easeInOutSine(t / WIND_MS);

  const launch = from - WIND_DEG;
  const past = to + OVERSHOOT_DEG;
  if (t < WIND_MS + MAIN_MS) {
    return launch + (past - launch) * easeOutCubic((t - WIND_MS) / MAIN_MS);
  }

  if (t < SPIN_TOTAL_MS) {
    return past - OVERSHOOT_DEG * easeInOutSine((t - WIND_MS - MAIN_MS) / SETTLE_MS);
  }
  return to;
}

/** How far before an edge the peg starts pushing the pointer, in degrees. */
const CATCH_DEG = 5;
/** Furthest the pointer is pushed. */
const MAX_DEFLECT_DEG = 24;
/** Share of its deflection the pointer keeps each frame as it springs back. */
const SPRING = 0.72;

/**
 * The pointer's rotation for wheel angle `angle`, given the wheel's angle and
 * the pointer's rotation on the previous frame. Negative is pushed the way
 * the rim is moving.
 *
 * At speed a slice edge can pass entirely between two frames, so a crossing
 * is detected from the two angles, not by sampling the gap to the next edge;
 * near the end, the approaching edge pushes the pointer over gradually.
 */
export function pointerAt(
  angle: number,
  previousAngle: number,
  sliceDeg: number,
  previous: number,
): number {
  const crossed = Math.floor(angle / sliceDeg) !== Math.floor(previousAngle / sliceDeg);
  // Degrees until the next slice edge reaches the pointer at the top.
  const toEdge = (((-angle) % sliceDeg) + sliceDeg) % sliceDeg;
  const pushed = crossed
    ? -MAX_DEFLECT_DEG
    : toEdge < CATCH_DEG
      ? -MAX_DEFLECT_DEG * (1 - toEdge / CATCH_DEG)
      : 0;
  return Math.min(pushed, previous * SPRING);
}
