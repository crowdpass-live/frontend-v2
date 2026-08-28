import { NO_VALUE } from "@/lib/admin-format";
import { cx } from "@/components/ui";

/**
 * One number, with room for the thing that makes it readable.
 *
 * `hint` is not decoration. When a value is `NO_VALUE` it is the only place
 * that can say *why* there is nothing — "no sales in this range" rather than a
 * bare dash — which is what keeps an empty period from reading as a failing
 * one. Callers pass the reason; this refuses to invent one.
 */
export function StatTile({
  label,
  value,
  hint,
  title,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Exact figure for a rounded display value, surfaced on hover. */
  title?: string;
  tone?: "default" | "accent";
  className?: string;
}) {
  const empty = value === NO_VALUE;
  return (
    <div
      className={cx(
        "flex flex-col gap-1 rounded-card border p-4",
        tone === "accent"
          ? "border-accent-tint-border bg-accent-tint"
          : "border-border bg-surface",
        className,
      )}
    >
      <p className="text-helper text-text-faint">{label}</p>
      <p
        title={title}
        className={cx(
          "text-metric font-bold tracking-tight tabular-nums",
          empty ? "text-text-faint" : "text-text",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-helper text-text-faint">{hint}</p> : null}
    </div>
  );
}

/** A labelled row inside a panel — for breakdowns that aren't worth a tile. */
export function StatRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="min-w-0 truncate text-label text-text-dim">{label}</span>
      <span className="shrink-0 text-right">
        <span className="block text-label font-bold tabular-nums text-text">
          {value}
        </span>
        {sub ? (
          <span className="block text-helper text-text-faint">{sub}</span>
        ) : null}
      </span>
    </div>
  );
}

export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
      <div>
        <h2 className="text-section font-bold text-text">{title}</h2>
        {note ? (
          <p className="mt-0.5 text-helper text-text-faint">{note}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
