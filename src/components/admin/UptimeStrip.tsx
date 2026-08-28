"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  getUptimeServerSnapshot,
  getUptimeSnapshot,
  stripFrom,
  subscribeUptime,
  summarise,
  WINDOW_DAYS,
  type StripDay,
} from "@/lib/uptime-history";
import { LEVEL_LABEL, type Level } from "@/lib/status-model";
import { cx } from "@/components/ui";

/**
 * The 90-day bar from a public status page.
 *
 * The colours carry the whole meaning, so they are assigned strictly:
 *
 * - green — observed, fully operational
 * - amber — observed, degraded or partial
 * - red — observed, major outage
 * - **grey — nobody was watching.** Not green. This is the difference between
 *   this strip and a dishonest one: a real uptime bar is drawn from an external
 *   prober running whether or not anyone is looking, and CrowdPass has none, so
 *   most of the window is genuinely unknown until a backend records samples on
 *   a schedule.
 *
 * The percentage beneath is over **observed days only** and says so, because
 * "100% uptime" over four watched days is not an uptime figure.
 */

const BAR: Record<Level, string> = {
  operational: "bg-ok",
  degraded: "bg-warn",
  partial: "bg-warn",
  major: "bg-danger",
  unknown: "bg-border-strong",
};

export function UptimeStrip({ componentKey }: { componentKey: string }) {
  // Subscribed rather than polled: the store notifies on every write, so the
  // strip grows a slot the moment a sample lands, with no signal prop and no
  // setState in an effect.
  const days = useSyncExternalStore(
    subscribeUptime,
    getUptimeSnapshot,
    getUptimeServerSnapshot,
  );
  const strip = useMemo(
    () => stripFrom(days, componentKey),
    [days, componentKey],
  );
  const { observedDays, operationalRate } = summarise(strip);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex h-8 items-stretch gap-[2px]"
        role="img"
        aria-label={ariaLabel(strip, observedDays, operationalRate)}
      >
        {strip.map((d) => (
          <span
            key={d.day}
            title={
              d.level
                ? `${d.day} — ${LEVEL_LABEL[d.level]}`
                : `${d.day} — no data (nobody was watching)`
            }
            className={cx(
              "min-w-0 flex-1 rounded-[2px] transition-opacity hover:opacity-70",
              d.level ? BAR[d.level] : "bg-surface-strong",
            )}
          />
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-3 text-helper text-text-faint">
        <span>{WINDOW_DAYS} days ago</span>
        <span className="text-center">
          {observedDays === 0 ? (
            "No days recorded yet"
          ) : (
            <>
              {(operationalRate! * 100).toFixed(1)}% of{" "}
              <span title="Only days on which this page was open can be recorded.">
                {observedDays} observed day{observedDays === 1 ? "" : "s"}
              </span>
            </>
          )}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

function ariaLabel(
  strip: StripDay[],
  observedDays: number,
  rate: number | null,
): string {
  if (observedDays === 0) {
    return `No uptime history recorded yet for the past ${WINDOW_DAYS} days.`;
  }
  const bad = strip.filter(
    (d) => d.level && d.level !== "operational",
  ).length;
  return (
    `Over the past ${WINDOW_DAYS} days, ${observedDays} were recorded by this browser. ` +
    `${(rate! * 100).toFixed(1)}% of recorded days were fully operational` +
    (bad > 0 ? `, with ${bad} showing a problem.` : ".") +
    ` The remaining ${WINDOW_DAYS - observedDays} days have no data.`
  );
}
