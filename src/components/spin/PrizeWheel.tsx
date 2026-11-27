"use client";

import type { SpinPrize } from "@/lib/spin-wheel";

/**
 * The wheel itself: pure display. It never decides anything. The server picks
 * the result and `SpinPlay` turns that into a `rotation` that lands the
 * matching segment under the pointer.
 *
 * SVG, not canvas or a library: a dozen paths that scale to any phone, theme
 * through the colour tokens, and cost nothing on mobile data.
 */

export interface WheelSegment {
  /** Null is the "next time" segment. */
  prizeId: string | null;
  label: string;
}

/** Segments in wheel order: prizes, then "next time", repeated to at least 8. */
export function buildSegments(prizes: SpinPrize[]): WheelSegment[] {
  const one: WheelSegment[] = [
    ...prizes.map((p) => ({ prizeId: p.id, label: p.label })),
    { prizeId: null, label: "Next time" },
  ];
  const out: WheelSegment[] = [];
  while (out.length < 8) out.push(...one);
  return out;
}

export const SPIN_DURATION_MS = 5200;

/**
 * Degrees to add to `from` so segment `index` stops under the top pointer,
 * after `turns` full turns. `nudge` (−0.5…0.5) keeps it from always landing
 * dead centre, which looks rigged.
 */
export function rotationFor(
  from: number,
  index: number,
  count: number,
  turns = 7,
  nudge = 0,
): number {
  const seg = 360 / count;
  const centre = (index + 0.5) * seg + nudge * seg * 0.7;
  const target = (360 - centre) % 360;
  const current = ((from % 360) + 360) % 360;
  let delta = target - current;
  if (delta < 0) delta += 360;
  return from + turns * 360 + delta;
}

const FILLS = [
  "var(--color-accent)",
  "var(--color-surface-strong)",
  "var(--color-accent-deep)",
  "var(--color-surface)",
];
// Black on orange, white on the dark fills (the design's button rule).
const TEXT = [
  "var(--color-ink)",
  "var(--color-text)",
  "var(--color-text)",
  "var(--color-text)",
];

const SIZE = 320;
const C = SIZE / 2;
const R = C - 10;

/** Rounded: server and browser disagree on the last float digits, and an
 * SVG path that differs by 1e-14 is a hydration mismatch. */
function point(deg: number, radius: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  const round = (n: number) => Math.round(n * 100) / 100;
  return [round(C + radius * Math.sin(rad)), round(C - radius * Math.cos(rad))];
}

/** Long labels go on two lines so they stay inside a narrow slice. */
function lines(label: string): string[] {
  const words = label.split(" ");
  if (words.length < 2 || label.length <= 9) return [label];
  return [words[0], words.slice(1).join(" ")];
}

export function PrizeWheel({
  segments,
  rotation,
  spinning,
}: {
  segments: WheelSegment[];
  rotation: number;
  /** Animate to `rotation` (false: jump, e.g. on load). */
  spinning: boolean;
}) {
  const seg = 360 / segments.length;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px]">
      {/* Pointer */}
      <svg
        aria-hidden
        viewBox="0 0 40 36"
        className="absolute left-1/2 top-0 z-10 w-10 -translate-x-1/2 -translate-y-1 drop-shadow"
      >
        <path d="M20 34 L4 4 H36 Z" fill="var(--color-text)" />
        <path d="M20 26 L10 8 H30 Z" fill="var(--color-accent)" />
      </svg>

      {/* The div rotates, not an SVG group: CSS transforms on SVG children
          resolve their origin differently across browsers. */}
      <div
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.7, 0.12, 1)`
            : "none",
        }}
        className="size-full will-change-transform motion-reduce:!transition-none"
      >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Prize wheel: ${[...new Set(segments.map((s) => s.label))].join(", ")}`}
        className="size-full"
      >
        <circle cx={C} cy={C} r={C - 2} fill="var(--color-border-strong)" />
        <g>
          {segments.map((s, i) => {
            const a0 = i * seg;
            const a1 = (i + 1) * seg;
            const [x0, y0] = point(a0, R);
            const [x1, y1] = point(a1, R);
            const mid = a0 + seg / 2;
            const ls = lines(s.label);
            return (
              <g key={i}>
                <path
                  d={`M${C} ${C} L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`}
                  fill={FILLS[i % FILLS.length]}
                  stroke="var(--color-bg)"
                  strokeWidth={2}
                />
                <g transform={`rotate(${mid} ${C} ${C})`}>
                  {ls.map((line, j) => (
                    <text
                      key={j}
                      x={C}
                      y={C - R * 0.68 + j * 15}
                      textAnchor="middle"
                      fontSize={13}
                      fontWeight={700}
                      fill={TEXT[i % TEXT.length]}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              </g>
            );
          })}
        </g>
        <circle cx={C} cy={C} r={26} fill="var(--color-bg)" stroke="var(--color-accent)" strokeWidth={4} />
      </svg>
      </div>
    </div>
  );
}
