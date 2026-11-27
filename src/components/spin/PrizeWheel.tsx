"use client";

import type { SpinPrize } from "@/lib/spin-wheel";
import { prizeArt, wheelLabel } from "@/lib/spin-wheel";
import { BrandMark } from "@/components/BrandMark";
import { cx } from "@/components/ui";

/**
 * The wheel itself: pure display. It never decides anything. The server picks
 * the result and `SpinPlay` turns that into a `rotation` that lands the
 * matching slice under the pointer.
 *
 * Slices are deep, alternating tones so the prize art carries the colour; the
 * brand orange lives on the rim, the pointer and the winning slice. Labels run
 * along the radius, so they never collide however many slices there are.
 *
 * SVG, not canvas or a library: a dozen paths and five tiny vector icons that
 * scale to any phone and cost almost nothing on mobile data.
 */

export interface WheelSegment {
  /** Null is the "next time" slice. */
  prizeId: string | null;
  label: string;
  art: string;
}

/** Slices in wheel order: prizes, then "next time", repeated to at least 8. */
export function buildSegments(prizes: SpinPrize[]): WheelSegment[] {
  const one: WheelSegment[] = [
    ...prizes.map((p) => ({ prizeId: p.id, label: wheelLabel(p), art: prizeArt(p) })),
    { prizeId: null, label: "Next time", art: prizeArt(null) },
  ];
  const out: WheelSegment[] = [];
  while (out.length < 8) out.push(...one);
  return out;
}

export const SPIN_DURATION_MS = 5200;

/**
 * Degrees to add to `from` so slice `index` stops under the top pointer,
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

const SIZE = 360;
const C = SIZE / 2;
/** Slice radius; the rim sits just outside it. */
const R = 158;
const RIM = 170;
const ICON = 40;
const ICON_R = 120;
const LABEL_R = 70;

/** Rounded: server and browser disagree on the last float digits, and an
 * SVG path that differs by 1e-14 is a hydration mismatch. */
function point(deg: number, radius: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  const round = (n: number) => Math.round(n * 100) / 100;
  return [round(C + radius * Math.sin(rad)), round(C - radius * Math.cos(rad))];
}

function slicePath(a0: number, a1: number, radius: number): string {
  const [x0, y0] = point(a0, radius);
  const [x1, y1] = point(a1, radius);
  return `M${C} ${C} L${x0} ${y0} A${radius} ${radius} 0 0 1 ${x1} ${y1} Z`;
}

export function PrizeWheel({
  segments,
  rotation,
  spinning,
  winner = null,
}: {
  segments: WheelSegment[];
  rotation: number;
  /** Animate to `rotation` (false: jump, e.g. on load). */
  spinning: boolean;
  /** Slice index to light up once the wheel has stopped. */
  winner?: number | null;
}) {
  const seg = 360 / segments.length;
  const landed = winner !== null && !spinning;
  const pegs = segments.length * 2;

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[380px]"
      data-spinning={spinning || undefined}
    >
      {/* Pointer: fixed, ticks while the wheel turns. */}
      <svg
        aria-hidden
        viewBox="0 0 48 56"
        className="wheel-pointer absolute left-1/2 top-0 z-20 w-11 -translate-x-1/2 -translate-y-2 drop-shadow-[0_6px_10px_rgba(0,0,0,0.55)]"
      >
        {/* A rounded wedge, the shape of a wheel's flapper. */}
        <path
          d="M24 53 Q21.5 53 20.2 50.6 L5.4 15.6 Q3 8 11 8 H37 Q45 8 42.6 15.6 L27.8 50.6 Q26.5 53 24 53 Z"
          fill="var(--color-text)"
        />
        <circle cx="24" cy="19" r="6" fill="var(--color-accent)" />
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
        className="size-full will-change-transform"
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Prize wheel: ${[...new Set(segments.map((s) => s.label))].join(", ")}`}
          className="size-full"
        >
          <defs>
            <radialGradient id="slice-a" cx={C} cy={C} r={R} gradientUnits="userSpaceOnUse">
              <stop offset="0.25" style={{ stopColor: "var(--color-bg)" }} />
              <stop offset="1" style={{ stopColor: "var(--color-surface-strong)" }} />
            </radialGradient>
            <radialGradient id="slice-b" cx={C} cy={C} r={R} gradientUnits="userSpaceOnUse">
              <stop offset="0.25" style={{ stopColor: "var(--color-bg)" }} />
              <stop offset="1" style={{ stopColor: "var(--color-accent-tint-border)" }} />
            </radialGradient>
            <radialGradient id="slice-win" cx={C} cy={C} r={R} gradientUnits="userSpaceOnUse">
              <stop offset="0.2" style={{ stopColor: "var(--color-accent-deep)" }} />
              <stop offset="1" style={{ stopColor: "var(--color-accent)" }} />
            </radialGradient>
          </defs>

          {/* Rim */}
          <circle cx={C} cy={C} r={RIM} fill="none" stroke="var(--color-accent)" strokeWidth={16} />
          <circle cx={C} cy={C} r={R + 1} fill="none" stroke="var(--color-accent-deep)" strokeWidth={3} />

          {segments.map((s, i) => {
            const a0 = i * seg;
            const mid = a0 + seg / 2;
            const isWinner = landed && i === winner;
            return (
              <g
                key={i}
                className="transition-opacity duration-500"
                opacity={landed && !isWinner ? 0.35 : 1}
              >
                <path
                  d={slicePath(a0, a0 + seg, R)}
                  fill={isWinner ? "url(#slice-win)" : i % 2 ? "url(#slice-b)" : "url(#slice-a)"}
                  stroke="var(--color-bg)"
                  strokeWidth={1.5}
                />
                <g transform={`rotate(${mid} ${C} ${C})`}>
                  {/* The art is mostly orange, so on the lit orange slice it
                      sits on a white medallion instead of vanishing. */}
                  {isWinner ? (
                    <circle cx={C} cy={C - ICON_R} r={ICON / 2 + 6} fill="var(--color-text)" />
                  ) : null}
                  <image
                    href={s.art}
                    x={C - ICON / 2}
                    y={C - ICON_R - ICON / 2}
                    width={ICON}
                    height={ICON}
                  />
                  {/* Reads outward from the hub along the slice's centre line. */}
                  <text
                    x={C}
                    y={C - LABEL_R}
                    transform={`rotate(-90 ${C} ${C - LABEL_R})`}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={s.label.length > 7 ? 12 : 14}
                    fontWeight={700}
                    letterSpacing={0.2}
                    fill={isWinner ? "var(--color-ink)" : "var(--color-text)"}
                  >
                    {s.label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Light pegs on the rim; they chase while spinning. */}
          {Array.from({ length: pegs }, (_, i) => {
            const [x, y] = point((i * 360) / pegs, RIM);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={3.4}
                className={cx("wheel-peg", i % 2 ? "wheel-peg-b" : "wheel-peg-a")}
                fill="var(--color-text)"
              />
            );
          })}
        </svg>
      </div>

      {/* Hub: fixed, so the brand mark stays upright. */}
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 grid size-[17%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-accent bg-bg shadow-[0_0_0_6px_rgba(0,0,0,0.35)]"
      >
        <BrandMark width={30} />
      </div>
    </div>
  );
}
