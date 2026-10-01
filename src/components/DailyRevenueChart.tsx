"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ngn, ngnCompact, count, shortDay } from "@/lib/metric-format";

/** One day: naira on the axis, a count (transactions, tickets) in the tooltip. */
export interface DailyPoint {
  /** `YYYY-MM-DD` */
  day: string;
  value: number;
  count: number;
}

/**
 * Daily naira over a range — platform GMV on the admin console, one event's
 * ticket revenue in the organizer's control room.
 *
 * **One axis, deliberately.** Both callers have a second measure per day (a
 * count), and the obvious move — plotting both — would be a dual-axis chart:
 * two scales whose alignment is arbitrary, inventing a correlation the data
 * does not contain. The count rides in the tooltip instead, where it can be
 * read against the same day without implying a shape.
 *
 * One series, so there is no legend (the heading names it) and no categorical
 * palette to get wrong — a single brand hue carries the whole plot. Values are
 * not printed on every point; the axis and the tooltip carry them.
 */

/**
 * Drawn at the container's real pixel width, not a fixed viewBox stretched
 * to fit. A stretched 760-wide canvas on a 320px phone shrinks the 11px axis
 * labels to ~5px and squashes them sideways (`preserveAspectRatio="none"`
 * scales text too); measuring keeps one SVG unit = one CSS pixel at every
 * width. 760 is only the first paint, before the measurement lands.
 */
const HEIGHT = 240;
const PAD = { top: 16, right: 12, bottom: 26, left: 54 };
/** Minimum room per x-axis date label, so they never collide. */
const LABEL_SPACING = 64;

/** A rounded axis maximum, so gridline labels are readable numbers. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * mag) return step * mag;
  }
  return 10 * mag;
}

export function DailyRevenueChart({
  data,
  label,
  countNoun,
  emptyText,
}: {
  data: DailyPoint[];
  /** What the series is, for the accessible name and table caption. */
  label: string;
  /** Singular and plural for the tooltip count: ["ticket", "tickets"]. */
  countNoun: [string, string];
  emptyText: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(760);
  useEffect(() => {
    if (!frame) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    ro.observe(frame);
    return () => ro.disconnect();
  }, [frame]);
  const VB = { w: width, h: HEIGHT };
  const PLOT = {
    w: VB.w - PAD.left - PAD.right,
    h: VB.h - PAD.top - PAD.bottom,
  };
  // Two charts on one page must not share a gradient id.
  const fillId = `daily-fill-${useId().replace(/:/g, "")}`;
  const [hover, setHover] = useState<number | null>(null);

  const { points, max, path, area } = useMemo(() => {
    const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
    // A single day would divide by zero; pin it to the middle of the plot.
    const stepX = data.length > 1 ? PLOT.w / (data.length - 1) : 0;
    const points = data.map((d, i) => ({
      ...d,
      x: PAD.left + (data.length > 1 ? i * stepX : PLOT.w / 2),
      y: PAD.top + PLOT.h - (d.value / max) * PLOT.h,
    }));
    const path = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
    const area = points.length
      ? `${path} L${points[points.length - 1].x},${PAD.top + PLOT.h} L${points[0].x},${PAD.top + PLOT.h} Z`
      : "";
    return { points, max, path, area };
  }, [data, PLOT.w, PLOT.h]);

  if (data.length === 0) {
    return (
      <div className="grid h-[240px] place-items-center rounded-card border border-border bg-surface">
        <p className="text-label text-text-faint">{emptyText}</p>
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
  const labelSlots = Math.max(2, Math.floor(PLOT.w / LABEL_SPACING));
  const labelEvery = Math.max(1, Math.ceil(data.length / labelSlots));

  return (
    <div ref={setFrame} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB.w} ${VB.h}`}
        preserveAspectRatio="none"
        className="h-[240px] w-full touch-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`${label}, ${data.length} days. The same figures are in the table below.`}
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
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
                className="fill-[var(--color-text-faint)] text-[12px]"
              >
                {v === 0 ? "0" : ngnCompact(v)}
              </text>
            </g>
          );
        })}

        <path d={area} fill={`url(#${fillId})`} />
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
              className="fill-[var(--color-text-faint)] text-[12px]"
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
          <p className="text-body font-bold text-text">{ngn(active.value)}</p>
          <p className="text-helper text-text-dim">
            {count(active.count)} {active.count === 1 ? countNoun[0] : countNoun[1]}
          </p>
        </div>
      ) : null}

      {/* The table view the chart's aria-label promises. Visually hidden, but
          reachable — a chart is not readable by assistive tech, and the
          numbers behind it must be. */}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Naira</th>
            <th scope="col">{countNoun[1]}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{ngn(d.value)}</td>
              <td>{count(d.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
