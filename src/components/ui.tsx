import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

// Deliberately no width. `w-full` here and `w-auto` at a call site are both
// `width` utilities, so which one wins is decided by their order in the
// generated stylesheet, not by the order of the class attribute — the
// override silently loses and the button eats its neighbours. Every call site
// states its own width.
const BUTTON_BASE =
  "inline-flex h-14 items-center justify-center gap-2 rounded-control " +
  "px-6 text-body font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45";

const BUTTON_VARIANTS = {
  // Black text on orange — the design's most easily-missed rule.
  primary: "bg-accent text-ink hover:bg-accent-hi disabled:hover:bg-accent",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-strong",
  ghost: "bg-transparent text-text-dim hover:text-text",
} as const;

type ButtonVariant = keyof typeof BUTTON_VARIANTS;

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return (
    <Link
      {...props}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cx(
        "rounded-card border border-border bg-surface",
        className,
      )}
    />
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-section font-bold text-text">{children}</h2>;
}

/**
 * Tinted-fill, coloured-text pill. Never a solid fill — the design uses these
 * for ticket status, sale state and the category chip alike.
 */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "accent" | "ok" | "warn" | "info" | "danger";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-strong text-text-dim",
    accent: "bg-accent/15 text-accent",
    ok: "bg-ok/15 text-ok",
    warn: "bg-warn/15 text-warn",
    info: "bg-info/15 text-info",
    danger: "bg-danger/15 text-danger",
  } as const;
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-3 py-1 text-helper font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * An inline error the buyer can act on. `role="alert"` so a screen reader
 * announces a failed purchase instead of leaving it silent below the fold.
 */
export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-control border border-danger/40 bg-danger/10 px-4 py-3 text-label text-danger"
    >
      {children}
    </p>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

/** Screen-side padding + max width. One place so pages can't drift apart. */
export function Shell({
  className,
  ...props
}: ComponentProps<"div">) {
  return <div {...props} className={cx("mx-auto w-full max-w-[560px] px-6", className)} />;
}
