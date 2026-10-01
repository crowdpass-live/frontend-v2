"use client";

import { useEffect, useRef } from "react";
import { cx } from "./ui";

const LENGTH = 6;

/**
 * Six boxes for an emailed code (#21). Ports the code entry in
 * `VerifyEmailScreen.js` / `ResetCodeScreen.js`.
 *
 * The value is one string; the boxes are a view of it. Pasting anywhere
 * fills from that box onward (email clients copy the whole code); typing
 * advances; Backspace on an empty box steps back and clears it; arrows move.
 * `autoComplete="one-time-code"` on the first box lets a phone offer the
 * code from the email or SMS banner, and `inputMode="numeric"` brings up the
 * number pad.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  label = "6-digit code",
  focusKey,
}: {
  value: string;
  onChange: (code: string) => void;
  /** Called once all six digits are present, e.g. to submit. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
  /**
   * Change this (e.g. bump a counter after a wrong code) to put the cursor
   * back in the first box — the boxes are disabled while a code is
   * checked, which drops focus, and on a phone that is an extra tap.
   * Also focuses on mount when set.
   */
  focusKey?: number;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (focusKey === undefined || disabled) return;
    refs.current[0]?.focus();
  }, [focusKey, disabled]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  function focus(i: number) {
    const el = refs.current[Math.max(0, Math.min(LENGTH - 1, i))];
    el?.focus();
    el?.select();
  }

  function write(from: number, incoming: string) {
    const clean = incoming.replace(/\D/g, "");
    if (!clean) return;
    const next = (value.slice(0, from) + clean).slice(0, LENGTH);
    onChange(next);
    if (next.length === LENGTH) {
      refs.current[LENGTH - 1]?.blur();
      onComplete?.(next);
    } else {
      focus(next.length);
    }
  }

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 text-label text-text-dim">{label}</legend>
      <div className="flex justify-between gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={i === 0 ? LENGTH : 1}
            aria-label={`Digit ${i + 1} of ${LENGTH}`}
            aria-invalid={invalid || undefined}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              const v = e.currentTarget.value;
              // The first box accepts a full code (one-time-code autofill
              // writes all six digits into it at once).
              if (v.length > 1) write(i, v);
              else if (v === "") onChange(value.slice(0, i));
              else write(i, v);
            }}
            onPaste={(e) => {
              e.preventDefault();
              write(i, e.clipboardData.getData("text"));
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !d && i > 0) {
                e.preventDefault();
                onChange(value.slice(0, i - 1));
                focus(i - 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                focus(i - 1);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                focus(i + 1);
              }
            }}
            className={cx(
              "h-14 w-full min-w-0 rounded-control border bg-surface text-center font-mono text-title text-text",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              invalid ? "border-danger" : "border-border",
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}
