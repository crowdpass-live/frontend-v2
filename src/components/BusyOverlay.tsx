"use client";

import { useEffect, useId, useRef } from "react";
import { BrandSpinner } from "./BrandSpinner";
import { CheckIcon } from "./icons";
import { cx } from "./ui";

/**
 * "Work in flight — don't touch anything" (#16). Ported from the busy half of
 * `v2-mobile/src/components/feedback.js`.
 *
 * For multi-step work where a second tap would do harm, publish above all:
 * it runs several steps and the on-chain leg is slow, so the overlay lists
 * the real steps and marks progress instead of a bare spinner.
 *
 * A native `<dialog>` opened with `showModal()` makes the page inert, and
 * Escape is swallowed — the work cannot be cancelled from here, so offering
 * to would be a lie. The caller closes it when the work settles, then reports
 * the outcome with a toast or an inline error.
 */
export function BusyOverlay({
  open,
  title,
  steps,
  current = 0,
}: {
  open: boolean;
  title: string;
  /** The real steps, in order. Omit for a single unnamed wait. */
  steps?: string[];
  /** Index of the step in progress; earlier ones render as done. */
  current?: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-busy={open}
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-card border border-border bg-surface p-0 text-text shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-5 p-6 text-center">
        <BrandSpinner width={72} label={title} />
        <h2 id={titleId} className="text-section font-bold text-text">
          {title}
        </h2>
        {steps?.length ? (
          <ol className="flex w-full flex-col gap-2 text-left" aria-live="polite">
            {steps.map((step, i) => {
              const state = i < current ? "done" : i === current ? "active" : "todo";
              return (
                <li
                  key={step}
                  aria-current={state === "active" ? "step" : undefined}
                  className={cx(
                    "flex items-center gap-3 text-label",
                    state === "done" && "text-text-dim",
                    state === "active" && "font-medium text-text",
                    state === "todo" && "text-text-faint",
                  )}
                >
                  <span
                    aria-hidden
                    className={cx(
                      "grid size-6 shrink-0 place-items-center rounded-full",
                      state === "done" && "bg-ok/15 text-ok",
                      state === "active" && "bg-accent/15 text-accent",
                      state === "todo" && "bg-surface-strong",
                    )}
                  >
                    {state === "done" ? (
                      <CheckIcon width={14} height={14} />
                    ) : state === "active" ? (
                      <span className="size-2 rounded-full bg-accent" />
                    ) : null}
                  </span>
                  <span>
                    {step}
                    <span className="sr-only">
                      {state === "done" ? " — done" : state === "active" ? " — in progress" : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
        <p className="text-helper text-text-faint">Keep this page open.</p>
      </div>
    </dialog>
  );
}
