import { MinusIcon, PlusIcon } from "./icons";
import { cx } from "./ui";

/**
 * A − n + quantity control (#15), generalised from the one that was inline
 * in checkout.
 *
 * Controlled and clamped: it never emits a value outside `[min, max]`, so a
 * caller can feed it straight into a request. The count is a polite live
 * region, so each tap is announced without stealing focus.
 */
export function Stepper({
  value,
  onChange,
  min = 1,
  max,
  label,
  disabled = false,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  /** What is being counted, for the button labels ("quantity", "tickets"). */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center gap-4", className)}>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="grid size-11 place-items-center rounded-full border border-border-strong text-text transition-colors hover:bg-surface disabled:opacity-35"
      >
        <MinusIcon />
      </button>
      <span
        aria-live="polite"
        className="min-w-8 text-center text-title font-bold text-text"
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="grid size-11 place-items-center rounded-full bg-accent text-ink transition-colors hover:bg-accent-hi disabled:opacity-35 disabled:hover:bg-accent"
      >
        <PlusIcon />
      </button>
    </div>
  );
}
