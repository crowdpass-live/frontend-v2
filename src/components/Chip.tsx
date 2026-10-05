import type { ComponentProps } from "react";
import { cx } from "./ui";

/**
 * A pill toggle for filters and categories (#15). Ported from mobile's
 * `ui.js` chip.
 *
 * Active is a SOLID orange fill with black text — a chip is a control, not a
 * status, so the tinted-pill rule (`Badge`) does not apply. `aria-pressed`
 * carries the state for assistive tech.
 *
 * A strip of chips is the one thing allowed to overflow-x: wrap the row in
 * its own `overflow-x-auto` scroller, never let it push the page.
 */
export function Chip({
  active = false,
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      {...props}
      type={type}
      aria-pressed={active}
      className={cx(
        "h-10 shrink-0 rounded-full px-4 text-label font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        active
          ? "bg-accent text-ink"
          : "bg-surface text-text-dim hover:bg-surface-strong hover:text-text",
        className,
      )}
    />
  );
}
