import { useId, type ComponentProps } from "react";
import { cx } from "./ui";

/**
 * A labelled date-and-time input (#15). Mobile uses a native picker
 * (`@react-native-community/datetimepicker`); the browser's own is
 * `<input type="datetime-local">`, so there is nothing to port but the label,
 * the error and the box.
 *
 * The value is LOCAL wall-clock time (`YYYY-MM-DDTHH:mm`). Convert to and
 * from the API's ISO strings with `toLocalInputValue` /
 * `fromLocalInputValue` in `@/lib/datetime-local` — never by hand.
 */
export function DateTimeField({
  label,
  hint,
  error,
  className,
  id,
  ...props
}: Omit<ComponentProps<"input">, "type" | "children"> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const errorId = `${inputId}-error`;

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={inputId} className="text-label text-text-dim">
        {label}
        {hint ? <span className="text-text-faint"> · {hint}</span> : null}
      </label>
      <input
        {...props}
        id={inputId}
        type="datetime-local"
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        // `[color-scheme:dark]` so the native picker opens dark to match.
        className={cx(
          "h-14 w-full min-w-0 rounded-control border bg-surface px-4 text-body text-text [color-scheme:dark]",
          "disabled:cursor-not-allowed disabled:opacity-45",
          error ? "border-danger" : "border-border",
        )}
      />
      {error ? (
        <span id={errorId} role="alert" className="text-helper text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
