import { Container, cx } from "@/components/ui";

/**
 * A working page with a side column on wide screens: the task on the left,
 * kept to a readable width, and context on the right — what you'll need,
 * how it works — sticky as the task scrolls.
 *
 * The side column is wide-screen only: on a phone the task is the page, and
 * those pages already carry the essentials inline. Pass `asideOnMobile` to
 * keep it, stacked after the task.
 */
export function SplitPage({
  header,
  aside,
  asideOnMobile = false,
  children,
}: {
  header?: React.ReactNode;
  aside?: React.ReactNode;
  asideOnMobile?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Container size="page" className="flex flex-col gap-6 py-8 sm:py-10">
      {header}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start xl:gap-12">
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
        {aside ? (
          <aside className={cx("flex-col gap-4 lg:sticky lg:top-24 lg:flex", asideOnMobile ? "flex" : "hidden")}>
            {aside}
          </aside>
        ) : null}
      </div>
    </Container>
  );
}

/** One block of side-column context. */
export function AsideCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 text-label font-bold text-text">
        {icon ? <span aria-hidden className="text-accent">{icon}</span> : null}
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-label text-text-dim">{children}</div>
    </section>
  );
}
