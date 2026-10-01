"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui";
import type { ApiCheckinRoster, TicketStatus } from "@/types/api";

const STATUS: Partial<Record<TicketStatus, { label: string; tone: "ok" | "info" | "warn" | "danger" | "neutral" }>> = {
  CONFIRMED: { label: "Not in yet", tone: "ok" },
  USED: { label: "Checked in", tone: "info" },
  PENDING: { label: "Payment pending", tone: "warn" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};

/**
 * The guest list at the door: the fallback for a QR that will not scan, a
 * flat phone, or a ticket still minting (it has a reference and no QR).
 *
 * The DOOR privacy tier — `checkin-roster` carries names only, no email or
 * phone, and its search matches names only. Never swap this for the
 * organizer's attendee list (#41): a delegate holding a phone for one
 * evening must not walk off with the event's contact list.
 *
 * Picking a row does not check anyone in; it hands the reference to the
 * same verify step a scan goes through.
 */
export function DoorRoster({
  eventId,
  onPick,
  refreshKey,
}: {
  eventId: string;
  onPick: (reference: string) => void;
  /** Bumped after a check-in, so the list reflects it. */
  refreshKey: number;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ApiCheckinRoster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Debounced: one request per pause in typing, not per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams({ limit: "30" });
    if (query) params.set("search", query);
    apiFetch<ApiCheckinRoster>(
      `/organizer/events/${encodeURIComponent(eventId)}/checkin-roster?${params}`,
      { auth: true },
    )
      .then((d) => {
        if (!live) return;
        setData(d);
        setError(null);
      })
      .catch((err) => {
        if (!live) return;
        setError(
          err instanceof ApiError && err.status === 0
            ? "No connection — the guest list couldn't load."
            : err instanceof ApiError
              ? err.message
              : "The guest list couldn't load.",
        );
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [eventId, query, refreshKey]);

  return (
    <div className="flex flex-col gap-3">
      {data ? (
        <p className="text-label text-text-dim">
          <span className="font-bold text-text">{data.summary.checkedIn}</span> checked in ·{" "}
          <span className="font-bold text-text">{data.summary.expected}</span> still to arrive
        </p>
      ) : null}
      <label className="sr-only" htmlFor="door-roster-search">
        Search guests by name
      </label>
      <input
        id="door-roster-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Guest's name"
        autoComplete="off"
        className="h-12 w-full rounded-control border border-border bg-surface px-4 text-body text-text placeholder:text-text-faint"
      />
      {error ? (
        <p role="alert" className="text-label text-danger">{error}</p>
      ) : loading && !data ? (
        <p className="text-label text-text-faint">Loading the guest list…</p>
      ) : data && data.attendees.length === 0 ? (
        <p className="py-6 text-center text-label text-text-faint">
          {query ? `No guest named “${query}”.` : "No tickets for this event yet."}
        </p>
      ) : data ? (
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
          {data.attendees.map((a) => {
            const st = STATUS[a.status] ?? { label: a.status, tone: "neutral" as const };
            return (
              <li key={a.ticketReference}>
                <button
                  type="button"
                  onClick={() => onPick(a.ticketReference)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-strong"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-text">
                      {a.buyerName || "No name on ticket"}
                    </span>
                    <span className="block truncate text-helper text-text-faint">
                      {a.ticketType} · {a.ticketReference}
                    </span>
                  </span>
                  <Badge tone={st.tone} className="shrink-0">{st.label}</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {data && data.pagination.total > data.attendees.length ? (
        <p className="text-center text-helper text-text-faint">
          Showing {data.attendees.length} of {data.pagination.total} — type a name to narrow it.
        </p>
      ) : null}
    </div>
  );
}
