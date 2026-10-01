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
//
// Height, padding and type size have the same trap, so they are NOT in the
// base either: they come from `size`. A call site passing `h-10` against a
// base `h-14` loses the same way and renders a 56px button.
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-control " +
  "font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45";

const BUTTON_SIZES = {
  /** The default: primary actions, form submits. */
  md: "h-14 px-6 text-body",
  /** Toolbars and inline actions beside a compact input. */
  sm: "h-10 px-4 text-label",
} as const;

type ButtonSize = keyof typeof BUTTON_SIZES;

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
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      {...props}
      className={cx(BUTTON_BASE, BUTTON_SIZES[size], BUTTON_VARIANTS[variant], className)}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
      {...props}
      className={cx(BUTTON_BASE, BUTTON_SIZES[size], BUTTON_VARIANTS[variant], className)}
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

/** A labelled text input with an inline validation error. Shared by every
 * guest form (checkout, ticket claim) so they read as one design. */
export function Field({
  label,
  hint,
  error,
  className,
  ...props
}: ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className={cx("flex flex-col gap-2", className)}>
      <span className="text-label text-text-dim">
        {label}
        {hint ? <span className="text-text-faint"> · {hint}</span> : null}
      </span>
      <input
        {...props}
        aria-invalid={!!error}
        className={cx(
          "h-14 rounded-control border bg-surface px-4 text-body text-text placeholder:text-text-faint",
          error ? "border-danger" : "border-border",
        )}
      />
      {error ? (
        <span role="alert" className="text-helper text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

/**
 * Screen-side padding + max width. One place so pages can't drift apart.
 *
 * Two widths, because the pages want different things of a large screen:
 *
 *   `reading` — a single column that stays comfortable to read and to fill in.
 *     Checkout, the ticket, and the payment result never widen: a 1400px-wide
 *     form is harder to complete than a 560px one, and the ticket is a card,
 *     not a page.
 *   `page`    — browse and event surfaces, which have genuine parallel content
 *     (a grid of events; details beside a ticket panel) and earn the room.
 *
 * Padding steps up with the viewport so content never touches the edge on a
 * phone and never hugs the frame on a desktop.
 */
export function Container({
  size = "reading",
  className,
  ...props
}: ComponentProps<"div"> & { size?: "reading" | "page" }) {
  return (
    <div
      {...props}
      className={cx(
        "mx-auto w-full px-5 sm:px-6 lg:px-8",
        size === "page" ? "max-w-6xl" : "max-w-[560px]",
        className,
      )}
    />
  );
}
