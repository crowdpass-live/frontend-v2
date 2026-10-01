import Link from "next/link";

/**
 * Previous / next links for a server-paginated list. Links, not buttons:
 * every page is a URL, so it works without JavaScript and can be shared.
 * Renders nothing when everything fits on one page.
 */
export function Pager({
  page,
  totalPages,
  hrefFor,
  summary,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  /** Replaces the default "Page n of m". */
  summary?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3">
      <PagerLink href={hrefFor(page - 1)} disabled={page <= 1}>
        Previous
      </PagerLink>
      <span className="text-center text-helper text-text-faint">
        {summary ?? `Page ${page} of ${totalPages}`}
      </span>
      <PagerLink href={hrefFor(page + 1)} disabled={page >= totalPages}>
        Next
      </PagerLink>
    </nav>
  );
}

function PagerLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span aria-disabled className="inline-flex min-h-10 items-center px-4 text-label text-text-faint opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface px-4 text-label text-text-dim transition-colors hover:text-text"
    >
      {children}
    </Link>
  );
}
