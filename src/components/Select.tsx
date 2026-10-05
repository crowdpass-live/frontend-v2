import { useId, type ComponentProps } from "react";
import { CaretDownIcon } from "./icons";
import { cx } from "./ui";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * A labelled dropdown backed by the native `<select>` (#15) — country, bank
 * and category pickers.
 *
 * Native on purpose: on a phone it opens the OS picker, which is the best
 * list UI the device has, and it is keyboard- and screen-reader-complete for
 * free. The box matches `TextField` so a form reads as one design; the
 * browser's own arrow is hidden and replaced by `CaretDownIcon`.
 *
 * `placeholder` renders as a disabled empty option, so an unpicked value is
 * `""` — the form's validator decides whether that is allowed.
 */
export function Select({
  label,
  options,
  placeholder,
  error,
  hint,
  className,
  id,
  ...props
}: Omit<ComponentProps<"select">, "children"> & {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  hint?: string;
}) {
  const fallbackId = useId();
  const selectId = id ?? fallbackId;
  const errorId = `${selectId}-error`;

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={selectId} className="text-label text-text-dim">
        {label}
        {hint ? <span className="text-text-faint"> · {hint}</span> : null}
      </label>
      <div className="relative">
        <select
          {...props}
          id={selectId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={cx(
            "h-14 w-full appearance-none rounded-control border bg-surface pl-4 pr-11 text-body text-text",
            "disabled:cursor-not-allowed disabled:opacity-45",
            error ? "border-danger" : "border-border",
          )}
        >
          {placeholder !== undefined ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <CaretDownIcon className="pointer-events-none absolute inset-y-0 right-4 my-auto text-text-faint" />
      </div>
      {error ? (
        <span id={errorId} role="alert" className="text-helper text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
