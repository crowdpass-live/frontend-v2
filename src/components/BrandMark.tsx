import { cx } from "./ui";

/**
 * The CrowdPass mark, as vector geometry.
 *
 * The delivered brand asset is a flat PNG (design open issue #12 — no vector
 * source). These coordinates were traced off `logo-mark.png` by the mobile
 * team, scanning horizontal pixel runs row by row in the original 2184×1320
 * canvas, so the pieces can move independently. Ported here verbatim from
 * `v2-mobile/src/components/AnimatedMark.js` — the two must not drift, or the
 * same brand animates differently on the two surfaces. Replace both with the
 * designer's SVG when it arrives.
 */
export const MARK_VIEWBOX = { w: 2184, h: 1320 };

/**
 * Six axis-aligned blocks, ordered as the loading pulse travels — down the
 * left column, across the top, back round the right — so the lit band circles
 * the mark instead of flickering.
 */
export const MARK_BLOCKS = [
  { key: "l", x: 0, y: 345, w: 325, h: 325 },
  { key: "tl", x: 325, y: 20, w: 727, h: 325 },
  { key: "tr", x: 1131, y: 20, w: 728, h: 325 },
  { key: "r", x: 1858, y: 345, w: 325, h: 325 },
  { key: "br", x: 1533, y: 670, w: 326, h: 325 },
  { key: "bl", x: 325, y: 670, w: 727, h: 325 },
] as const;

/**
 * The P stem — the "door". A quadrilateral, not a rectangle: its left edge is
 * the taller one (the hinge) and its right edge is shorter and dropped, which
 * is what gives the mark its sense of a door standing ajar.
 */
export const MARK_DOOR = "M1131,345 L1457,503 L1456,1318 L1131,1153 Z";

/** The static mark, drawn rather than loaded. Inherits `currentColor`. */
export function BrandMark({
  width = 96,
  className,
}: {
  width?: number;
  className?: string;
}) {
  return (
    <svg
      width={width}
      height={(width * MARK_VIEWBOX.h) / MARK_VIEWBOX.w}
      viewBox={`0 0 ${MARK_VIEWBOX.w} ${MARK_VIEWBOX.h}`}
      fill="currentColor"
      aria-hidden
      className={cx("text-accent", className)}
    >
      {MARK_BLOCKS.map((b) => (
        <rect key={b.key} x={b.x} y={b.y} width={b.w} height={b.h} />
      ))}
      <path d={MARK_DOOR} />
    </svg>
  );
}
