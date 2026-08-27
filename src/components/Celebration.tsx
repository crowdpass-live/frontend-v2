"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * A one-shot confetti burst for the moment a ticket is first opened after
 * payment.
 *
 * CSS, not a canvas library: this runs once for a couple of seconds on a page
 * a buyer opens on Nigerian mobile data, and shipping a physics engine to
 * animate forty rectangles would cost more than the whole rest of the page.
 *
 * `pointer-events-none` throughout — the buyer's next move is Download or
 * Share, and confetti that eats a tap would be worse than no confetti.
 */

const COLORS = ["#FE5722", "#FA6533", "#E5BF4B", "#FFFFFF", "#43A047"];
const COUNT = 44;
const DURATION_MS = 3400;

interface Piece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotate: number;
  drift: number;
  round: boolean;
}

/** Deterministic PRNG so server and client agree if this ever pre-renders. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Celebration({ seed = 1 }: { seed?: number }) {
  const [done, setDone] = useState(false);

  const pieces = useMemo<Piece[]>(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: COUNT }, () => ({
      left: rand() * 100,
      delay: rand() * 600,
      duration: 2200 + rand() * 1400,
      color: COLORS[Math.floor(rand() * COLORS.length)],
      size: 7 + rand() * 9,
      rotate: rand() * 360,
      drift: (rand() - 0.5) * 180,
      round: rand() > 0.75,
    }));
  }, [seed]);

  // Unmount when the burst finishes: forty animated nodes left in the tree
  // keep the compositor busy for as long as the tab is open.
  useEffect(() => {
    const t = setTimeout(() => setDone(true), DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  if (done) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden motion-reduce:hidden"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece absolute top-0 block"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              background: p.color,
              borderRadius: p.round ? "50%" : 2,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
              "--confetti-rotate": `${p.rotate}deg`,
              "--confetti-drift": `${p.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
