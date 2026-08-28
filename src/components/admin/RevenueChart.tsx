"use client";

import { useMemo, useRef, useState } from "react";
import { ngn, ngnCompact, count, shortDay } from "@/lib/admin-format";
import type { AdminDailyPoint } from "@/types/admin";

/**
 * Daily GMV over the selected range.
 *
 * **One axis, deliberately.** The endpoint returns `gmv` and `transactions`
 * per day, and the obvious move — plotting both — would be a dual-axis chart:
 * two scales whose alignment is arbitrary, inventing a correlation the data
 * does not contain. Transactions ride in the tooltip instead, where they can
 * be read against the same day without implying a shape.
 *
 * One series, so there is no legend (the heading names it) and no categorical
 * palette to get wrong — a single brand hue carries the whole plot. Values are
 * not printed on every point; the axis and the tooltip carry them.
 */

const VB = { w: 760, h: 240 };
const PAD = { top: 16, right: 12, bottom: 26, left: 54 };
const PLOT = {
  w: VB.w - PAD.left - PAD.right,
  h: VB.h - PAD.top - PAD.bottom,
};

/** A rounded axis maximum, so gridline labels are readable numbers. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * mag) return step * mag;
  }
  return 10 * mag;
}

export function RevenueChart({ data }: { data: AdminDailyPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { points, max, path, area } = useMemo(() => {
    const max = niceMax(Math.max(0, ...data.map((d) => d.gmv)));
    // A single day would divide by zero; pin it to the middle of the plot.
    const stepX = data.length > 1 ? PLOT.w / (data.length - 1) : 0;
    const points = data.map((d, i) => ({
      ...d,
      x: PAD.left + (data.length > 1 ? i * stepX : PLOT.w / 2),
      y: PAD.top + PLOT.h - (d.gmv / max) * PLOT.h,
    }));
    const path = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
    const area = points.length
      ? `${path} L${points[points.length - 1].x},${PAD.top + PLOT.h} L${points[0].x},${PAD.top + PLOT.h} Z`
      : "";
    return { points, max, path, area };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="grid h-[240px] place-items-center rounded-card border border-border bg-surface">
        <p className="text-label text-text-faint">
          No settled transactions in this range.
        </p>
      </div>
    );
  }

  const active = hover !== null ? points[hover] : null;

  /** Nearest point to the pointer, in viewBox space. */
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const vbX = ((e.clientX - rect.left) / rect.width) * VB.w;
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - vbX);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  // Enough x labels to orient without collision at any width.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB.w} ${VB.h}`}
        preserveAspectRatio="none"
        className="h-[240px] w-full touch-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Daily gross merchandise value, ${data.length} days. The same figures are in the table below.`}
      >
        <defs>
          <linearGradient id="gmv-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Solid hairlines, one shade off the surface. Never dashed — dashing
            reads as a threshold or a projection when it is just a grid. */}
        {gridValues.map((v, i) => {
          const y = PAD.top + PLOT.h - (v / max) * PLOT.h;
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={VB.w - PAD.right}
                y1={y}
                y2={y}
                stroke="var(--color-border)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-[var(--color-text-faint)] text-[11px]"
              >
                {v === 0 ? "0" : ngnCompact(v)}
              </text>
            </g>
          );
        })}

        <path d={area} fill="url(#gmv-fill)" />
        <path
          d={path}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((p, i) =>
          i % labelEvery === 0 || i === points.length - 1 ? (
            <text
              key={p.day}
              x={p.x}
              y={VB.h - 8}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              className="fill-[var(--color-text-faint)] text-[11px]"
            >
              {shortDay(p.day)}
            </text>
          ) : null,
        )}

        {active ? (
          <g>
            <line
              x1={active.x}
              x2={active.x}
              y1={PAD.top}
              y2={PAD.top + PLOT.h}
              stroke="var(--color-border-strong)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            {/* 2px surface ring, rather than a border, to lift the marker off
                the line it sits on. */}
            <circle
              cx={active.x}
              cy={active.y}
              r={5}
              fill="var(--color-accent)"
              stroke="var(--color-bg)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ) : null}
      </svg>

      {active ? (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[168px] -translate-x-1/2 rounded-control border border-border bg-surface-strong px-3 py-2 shadow-lg"
          style={{
            left: `${(active.x / VB.w) * 100}%`,
            // Keep the card inside the plot at both ends.
            transform:
              active.x < VB.w * 0.15
                ? "translateX(0)"
                : active.x > VB.w * 0.85
                  ? "translateX(-100%)"
                  : "translateX(-50%)",
          }}
        >
          <p className="text-helper text-text-faint">{shortDay(active.day)}</p>
          <p className="text-body font-bold text-text">{ngn(active.gmv)}</p>
          <p className="text-helper text-text-dim">
            {count(active.transactions)} transaction
            {active.transactions === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      {/* The table view the chart's aria-label promises. Visually hidden, but
          reachable — a chart is not readable by assistive tech, and the
          numbers behind it must be. */}
      <table className="sr-only">
        <caption>Daily gross merchandise value and transaction count</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">GMV</th>
            <th scope="col">Transactions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{ngn(d.gmv)}</td>
              <td>{count(d.transactions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
