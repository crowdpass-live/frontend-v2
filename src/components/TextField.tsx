"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";
import { cx } from "./ui";

/**
 * A labelled input with an optional leading icon and, for passwords, a reveal
 * toggle. Ported from `v2-mobile/src/components/TextField.js` (#15).
 *
 * `Field` in `ui.tsx` stays the guest-form input; this is the account-form
 * one. They share the same box so the two read as one design.
 *
 * The focus ring sits on the whole box (`focus-within`), not the bare input,
 * so it wraps the icon and the toggle too instead of cutting between them.
 */
export function TextField({
  label,
  icon,
  error,
  type = "text",
  className,
  id,
  ...props
}: Omit<ComponentProps<"input">, "children"> & {
  label: string;
  icon?: ReactNode;
  error?: string;
}) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const errorId = `${inputId}-error`;
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={inputId} className="text-label text-text-dim">
        {label}
      </label>
      <div
        className={cx(
          "flex h-14 items-center gap-3 rounded-control border bg-surface px-4",
          "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
          error ? "border-danger" : "border-border",
        )}
      >
        {icon ? (
          <span className="shrink-0 text-text-faint" aria-hidden>
            {icon}
          </span>
        ) : null}
        <input
          {...props}
          id={inputId}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-body text-text placeholder:text-text-faint focus-visible:outline-none"
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            aria-label={revealed ? "Hide password" : "Show password"}
            aria-pressed={revealed}
            className="-mr-2 grid size-10 shrink-0 place-items-center rounded-full text-text-faint transition-colors hover:text-text"
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        ) : null}
      </div>
      {error ? (
        <span id={errorId} role="alert" className="text-helper text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
