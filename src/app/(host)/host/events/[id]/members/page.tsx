import type { Metadata } from "next";
import Link from "next/link";
import { ApiError } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { fetchClaimList, fetchOwnTicketTypes, settle } from "@/lib/organizer";
import { MemberListManager } from "@/components/host/MemberListManager";
import { cx } from "@/components/ui";

export const metadata: Metadata = { title: "Member lists" };

/**
 * Member lists — the dues lists behind members-only ticket types.
 *
 * Ticket types come from the same sources mobile uses (the public event when
 * published, the drafts list when a draft); the selected tier is in the URL
 * (`?tier=`), so each list is linkable and the manager below starts fresh
 * per tier. With no tier chosen, a members-only one is picked first — that
 * is the list someone opening this page is after.
 */
export default async function HostEventMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tier?: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const { tier: tierParam } = await searchParams;

  const tiers = await settle(fetchOwnTicketTypes(id));
  // The layout handles a 404 / not-yours event.
  if (!tiers.ok) {
    if (tiers.error instanceof ApiError && tiers.error.status === 403) return null;
    throw tiers.error;
  }
  if (!tiers.value) {
    return <Note>Couldn&apos;t find this event among yours.</Note>;
  }

  const { status, ticketTypes } = tiers.value;
  const editable = status === "PUBLISHED" || status === "DRAFT";
  if (!ticketTypes.length) {
    return (
      <Note>
        {editable
          ? "This event has no ticket types yet."
          : "Member lists can only be viewed while an event is a draft or live."}
      </Note>
    );
  }

  const selected =
    ticketTypes.find((t) => t.id === tierParam) ??
    ticketTypes.find((t) => t.claimOnly) ??
    ticketTypes[0];

  const list = await settle(fetchClaimList(id, selected.id));
  if (!list.ok) {
    if (list.error instanceof ApiError && list.error.status === 403) {
      return <Note>Only the event&apos;s organizer can manage its member lists.</Note>;
    }
    throw list.error;
  }

  const base = `/host/events/${id}/members`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="max-w-2xl text-label text-text-dim">
          A member list makes a ticket type members-only: it can&apos;t be
          bought, and the people on your list claim it free with their matric
          number and full name.
        </p>
      </div>

      {ticketTypes.length > 1 ? (
        <nav aria-label="Ticket types" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <ul className="flex w-max gap-2">
            {ticketTypes.map((t) => {
              const active = t.id === selected.id;
              return (
                <li key={t.id}>
                  <Link
                    href={`${base}?tier=${encodeURIComponent(t.id)}`}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-label transition-colors",
                      active
                        ? "border-accent bg-accent-tint text-text"
                        : "border-border bg-surface text-text-dim hover:text-text",
                    )}
                  >
                    {t.name}
                    {t.claimOnly ? (
                      <span className="rounded-full bg-info/15 px-2 py-0.5 text-helper text-info">
                        Members
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <MemberListManager
        key={selected.id}
        eventId={id}
        tier={{
          id: selected.id,
          name: selected.name,
          claimOnly: selected.claimOnly,
          soldCount: selected.soldCount,
        }}
        initial={list.value}
        editable={editable}
      />
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-card border border-dashed border-border px-5 py-10 text-center text-label text-text-faint">
      {children}
    </p>
  );
}
