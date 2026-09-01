import type { ReactNode } from "react";
import { Container } from "./ui";

/**
 * Shell and type scale for the policy pages (terms, privacy).
 *
 * These are the only long-form prose on the site, and the design system has
 * no prose styles — it was drawn for cards, tiers and a checkout. Rather than
 * let each page invent its own heading sizes, the three primitives here fix
 * them once.
 *
 * `Container size="reading"` deliberately: a policy is read top to bottom,
 * and the 560px column that keeps checkout comfortable is the right measure
 * for that too. A clause running the full desktop width is a clause nobody
 * finishes.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  /** Human-readable date. A policy with no date is not much of a policy. */
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col pb-20">
      <Container className="flex flex-col gap-8 pt-10 lg:pt-16">
        <header className="flex flex-col gap-2">
          <h1 className="text-display font-bold tracking-tight text-text text-balance">
            {title}
          </h1>
          <p className="text-helper text-text-faint">Last updated {updated}</p>
        </header>
        <div className="flex flex-col gap-8">{children}</div>
      </Container>
    </main>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section font-bold text-text">{heading}</h2>
      {children}
    </section>
  );
}

/** A paragraph of policy text. Dimmed — the headings carry the structure. */
export function LegalText({ children }: { children: ReactNode }) {
  return <p className="text-body text-text-dim">{children}</p>;
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-text-dim marker:text-text-faint">
      {items.map((item, i) => (
        // Policy bullets are fixed content in source order and never
        // reorder, so the index is a stable key here.
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
