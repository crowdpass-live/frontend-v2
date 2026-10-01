"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button, Spinner, cx } from "@/components/ui";
import type { ApiTicketAdmin, ApiUserLookup, EventStatus } from "@/types/api";

/** `TicketAdminsDto` caps a grant at 20 users; the UI adds one at a time. */
const LOOKUP_MIN = 2;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A grant for a user whose Circle wallet on the event's chain does not
 * exist yet fails with this 400. The request itself kicked provisioning
 * off, so it is "wait a moment", never a refusal (mobile:
 * `isWalletProvisioning`).
 */
function isWalletProvisioning(err: unknown): boolean {
  return err instanceof ApiError && err.status === 400 && /provisioning/i.test(err.message);
}

function message(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 0) {
    return "No connection. Nothing was changed — try again when you have signal.";
  }
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Grant and revoke door access for one event (#48).
 *
 * - **Granting is on-chain.** The backend writes the ticketAdmin role for
 *   every ticket type, so it takes seconds, and the button says why.
 * - **A provisioning wallet is not a failure.** The pick stays in place and
 *   the button becomes "Try again".
 * - **Revoking is immediate, even mid-shift.** The delegate's next scan is
 *   refused (the door console treats that 403 as terminal). Anyone they
 *   already checked in stays checked in. Both are said before confirming.
 */
export function CheckInTeam({
  eventId,
  eventStatus,
  selfId,
  initial,
}: {
  eventId: string;
  eventStatus: EventStatus;
  selfId: string;
  initial: ApiTicketAdmin[];
}) {
  const path = `/organizer/events/${encodeURIComponent(eventId)}/ticket-admins`;
  const [team, setTeam] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  // Each answer remembers the query it answers, so a stale one (the box has
  // moved on, or been cleared) is simply not shown — nothing to reset.
  const [lookup, setLookup] = useState<
    { q: string; users: ApiUserLookup[] | null; error: string | null } | null
  >(null);
  const [picked, setPicked] = useState<ApiUserLookup | null>(null);

  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

  const [removing, setRemoving] = useState<ApiTicketAdmin | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // A draft has no on-chain ticket types yet; the backend refuses to grant.
  const canGrant = eventStatus === "PUBLISHED";
  const onTeam = new Set(team.map((t) => t.userId));

  // Type-ahead: an exact email resolves one account; anything else searches
  // names and emails (2+ characters, at most 10 results).
  const query = search.trim();
  useEffect(() => {
    if (picked || query.length < LOOKUP_MIN) return;
    let live = true;
    const t = setTimeout(async () => {
      try {
        const users = EMAIL.test(query)
          ? [await apiFetch<ApiUserLookup>(`/organizer/users/lookup?email=${encodeURIComponent(query)}`, { auth: true })]
          : await apiFetch<ApiUserLookup[]>(`/organizer/users/lookup?q=${encodeURIComponent(query)}`, { auth: true });
        if (live) setLookup({ q: query, users, error: null });
      } catch (err) {
        if (!live) return;
        // An exact-email miss is a 404: an answer ("no such account"), not a failure.
        if (err instanceof ApiError && err.status === 404) setLookup({ q: query, users: [], error: null });
        else setLookup({ q: query, users: null, error: message(err, "Search failed. Try again.") });
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, picked]);
  const current = lookup?.q === query ? lookup : null;
  const results = current?.users ?? null;
  const lookupError = current?.error ?? null;
  const searching = query.length >= LOOKUP_MIN && !current;

  async function add() {
    if (!picked) return;
    setAdding(true);
    setAddError(null);
    setNotice(null);
    try {
      const updated = await apiFetch<ApiTicketAdmin[]>(path, {
        method: "POST",
        auth: true,
        body: { userIds: [picked.id] },
        // One on-chain write per ticket type.
        timeout: 60_000,
      });
      setTeam(updated);
      setNotice(`${picked.name} can now scan tickets for this event.`);
      setPicked(null);
      setSearch("");
      setWaiting(false);
    } catch (err) {
      if (isWalletProvisioning(err)) {
        setWaiting(true);
      } else {
        setWaiting(false);
        setAddError(message(err, "Couldn't add them to the door. Try again."));
      }
    } finally {
      setAdding(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      const updated = await apiFetch<ApiTicketAdmin[]>(path, {
        method: "DELETE",
        auth: true,
        // The ids travel in the body on this route, not the path.
        body: { userIds: [removing.userId] },
        timeout: 60_000,
      });
      setTeam(updated);
      setNotice(`${removing.name} can no longer scan tickets for this event.`);
      setRemoving(null);
    } catch (err) {
      setRemoveError(message(err, "Couldn't remove them. Try again."));
    } finally {
      setRemoveBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-label text-text-dim">
        People on your check-in team can scan tickets for this event from{" "}
        <span className="text-text">At the door</span> in their account menu.
        They get no access to your sales, attendees or money — just the door.
      </p>

      <p role="status" aria-live="polite" className={cx("text-label text-ok", !notice && "sr-only")}>
        {notice}
      </p>

      <section aria-labelledby="team-add" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:p-5">
        <h2 id="team-add" className="text-section font-bold text-text">Add someone</h2>

        {!canGrant ? (
          <p className="text-label text-text-dim">
            {eventStatus === "DRAFT"
              ? "Publish this event first — door access is written to the blockchain along with its tickets."
              : "This event is over, so no one new can be added to its door."}
          </p>
        ) : picked ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 rounded-control border border-accent-tint-border bg-accent-tint px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-body font-bold text-text">{picked.name}</p>
                <p className="truncate text-helper text-text-dim">{picked.email ?? "No email on account"}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPicked(null);
                  setWaiting(false);
                  setAddError(null);
                }}
                disabled={adding}
                className="inline-flex min-h-10 shrink-0 items-center rounded-full px-3 text-label text-text-dim hover:text-text disabled:opacity-45"
              >
                Change
              </button>
            </div>
            {waiting ? (
              <p className="rounded-control border border-warn/40 bg-warn/10 px-4 py-3 text-label text-warn">
                Setting up their wallet on this event&apos;s chain — try again in a moment.
              </p>
            ) : null}
            {addError ? <p role="alert" className="text-label text-danger">{addError}</p> : null}
            <Button type="button" onClick={add} disabled={adding} className="w-full sm:w-fit">
              {adding ? <Spinner /> : null}
              {adding ? "Adding — writing to the blockchain…" : waiting ? "Try again" : "Add to the door"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="team-search" className="text-label text-text-dim">
              Their CrowdPass account — name or email
            </label>
            <input
              id="team-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="e.g. kemi@example.com"
              className="h-12 w-full rounded-control border border-border bg-bg px-4 text-body text-text placeholder:text-text-faint"
            />
            {query.length > 0 && query.length < LOOKUP_MIN ? (
              <p className="text-helper text-text-faint">Keep typing…</p>
            ) : searching ? (
              <p className="text-helper text-text-faint">Searching…</p>
            ) : lookupError ? (
              <p role="alert" className="text-label text-danger">{lookupError}</p>
            ) : results && results.length === 0 ? (
              <p className="text-label text-text-faint">
                No CrowdPass account matches “{query}”. They need to sign up first —
                in the app or here.
              </p>
            ) : results ? (
              <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
                {results.map((u) => {
                  const self = u.id === selfId;
                  const already = onTeam.has(u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        disabled={self || already}
                        onClick={() => {
                          setPicked(u);
                          setAddError(null);
                          setWaiting(false);
                        }}
                        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-strong disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <span className="min-w-0">
                          <span className={cx("block truncate text-body", self || already ? "text-text-faint" : "text-text")}>
                            {u.name}
                          </span>
                          <span className="block truncate text-helper text-text-faint">{u.email ?? "No email on account"}</span>
                        </span>
                        {self || already ? (
                          <span className="shrink-0 text-helper text-text-faint">
                            {self ? "That's you" : "Already on the team"}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="team-list" className="flex flex-col gap-3">
        <h2 id="team-list" className="text-section font-bold text-text">
          On the door{team.length ? ` · ${team.length}` : ""}
        </h2>
        {team.length === 0 ? (
          <p className="rounded-card border border-dashed border-border px-5 py-8 text-center text-label text-text-faint">
            No one yet. You can always scan your own event yourself.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {team.map((m) => (
              <li key={m.userId} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-text">{m.name}</p>
                  <p className="truncate text-helper text-text-faint">
                    {m.email ?? "No email on account"} · added {formatDate(m.grantedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRemoveError(null);
                    setRemoving(m);
                  }}
                  aria-label={`Remove ${m.name} from the door`}
                  className="-ml-3 inline-flex min-h-10 w-fit items-center rounded-full px-3 text-label text-text-faint hover:bg-danger/10 hover:text-danger sm:ml-0"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.name ?? "them"} from the door?`}
        confirmLabel="Remove"
        tone="danger"
        busy={removeBusy}
        error={removeError}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      >
        <p>
          They stop being able to scan immediately, even mid-shift — their next
          scan is refused. Anyone they already checked in stays checked in.
        </p>
        <p>You can add them back at any time.</p>
      </ConfirmDialog>
    </div>
  );
}
