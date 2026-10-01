"use client";

import { useState } from "react";
import { count, ngn, NO_VALUE } from "@/lib/metric-format";
import { cx } from "@/components/ui";

export interface SoldByEventRow {
  id: string;
  name: string;
  sold: number;
  /** Capacity across the event's ticket types. */
  total: number;
  revenue: number;
}

/**
 * Tickets sold, one bar per event — the dashboard's only chart.
 *
 * **One series, one hue, one axis.** Revenue is a different measure on a
 * different scale; plotting it beside sales would be a dual-axis chart that
 * invents a correlation. It rides in the tooltip. Events are nominal
 * categories, so every bar wears the same accent — a hue per bar would only
 * restate the label.
 *
 * Horizontal because event names are long: a column chart would have to
 * truncate or rotate them. Each bar carries its value at the tip, so there is
 * no axis to read; the scale is the longest bar. Every number is also in the
 * visually hidden table, since a chart alone is not readable by assistive tech.
 */
export function SoldByEventChart({ rows }: { rows: SoldByEventRow[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(0, ...rows.map((r) => r.sold));

  if (max === 0) {
    return (
      <div className="grid h-40 place-items-center rounded-control border border-dashed border-border">
        <p className="text-label text-text-faint">No tickets sold yet.</p>
      </div>
    );
  }

  return (
    <div>
      <ol
        className="flex flex-col gap-3"
        aria-hidden
        onPointerLeave={() => setActive(null)}
      >
        {rows.map((row, i) => {
          const share = (row.sold / max) * 100;
          const pctSold = row.total ? Math.round((row.sold / row.total) * 100) : null;
          const on = active === i;
          return (
            <li
              key={row.id}
              // The row, not the 20px bar, is the hit target.
              className="relative flex cursor-default flex-col gap-1.5 rounded-control"
              onPointerEnter={() => setActive(i)}
            >
              <span
                className={cx(
                  "truncate text-label transition-colors",
                  on ? "text-text" : "text-text-dim",
                )}
              >
                {row.name}
              </span>
              <span className="flex items-center gap-2">
                {/* Square at the baseline, 4px round at the data end. A
                    non-zero value never renders thinner than 2px, or it
                    reads as zero. */}
                <span
                  className={cx(
                    "block h-5 rounded-r-[4px] bg-accent transition-opacity",
                    active !== null && !on && "opacity-55",
                  )}
                  style={{
                    width: row.sold ? `max(2px, calc(${share}% - 4rem))` : 0,
                  }}
                />
                <span className="shrink-0 text-label font-bold tabular-nums text-text">
                  {count(row.sold)}
                </span>
              </span>

              {on ? (
                <span className="pointer-events-none absolute right-0 top-0 z-10 rounded-control border border-border bg-surface-strong px-3 py-2 text-right shadow-lg">
                  <span className="block text-helper text-text-faint">
                    {count(row.sold)} of {count(row.total)} sold
                    {pctSold === null ? "" : ` · ${pctSold}%`}
                  </span>
                  <span className="block text-label font-bold text-text">
                    {ngn(row.revenue)}
                  </span>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <table className="sr-only">
        <caption>Tickets sold by event</caption>
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">Tickets sold</th>
            <th scope="col">Capacity</th>
            <th scope="col">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.name}</th>
              <td>{count(row.sold)}</td>
              <td>{row.total ? count(row.total) : NO_VALUE}</td>
              <td>{ngn(row.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
