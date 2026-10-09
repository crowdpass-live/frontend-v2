"use client";

import { useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { BPS_TOTAL, bpsToPercent, grossPercentOf, percentLabel, percentToBps } from "@/lib/shares";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { Button, Field, Spinner, cx } from "@/components/ui";
import type { ApiBeneficiaries, ApiUserLookup, EventStatus } from "@/types/api";

const LOOKUP_MIN = 2;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Beneficiary = ApiBeneficiaries["beneficiaries"][number];

function message(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 0) {
    return "No connection, so nothing was changed. Try again when you have signal.";
  }
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Revenue partners for one event (#43). Ports `EventBeneficiariesScreen.js`.
 *
 * - **The unit is the trap.** A share is a percentage of the ORGANIZER'S CUT
 *   (`shareBps`), not of gross. Every figure shows both: what was set and
 *   what that is of each ticket sold.
 * - A change applies to **new sales only**; money already split stays split.
 * - A partner is a per-event row, not a role: they don't become an
 *   organizer and get no access to this event.
 * - Removal is soft, and confirmed.
 */
export function BeneficiaryManager({
  eventId,
  eventStatus,
  selfId,
  initial,
}: {
  eventId: string;
  eventStatus: EventStatus;
  selfId: string;
  initial: ApiBeneficiaries;
}) {
  const path = `/organizer/events/${encodeURIComponent(eventId)}/beneficiaries`;
  const toast = useToast();
  const [data, setData] = useState(initial);
  const { beneficiaries, remainingBps, organizerSharePercent, maxBeneficiaries } = data;

  // --- add: type-ahead, the same lookup as the check-in team ---------------
  const [search, setSearch] = useState("");
  const [lookup, setLookup] = useState<
    { q: string; users: ApiUserLookup[] | null; error: string | null } | null
  >(null);
  const [picked, setPicked] = useState<ApiUserLookup | null>(null);
  const [addShare, setAddShare] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // --- edit / remove -------------------------------------------------------
  const [editing, setEditing] = useState<Beneficiary | null>(null);
  const [editShare, setEditShare] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Beneficiary | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const closed = eventStatus === "CANCELLED" || eventStatus === "COMPLETED";
  const full = beneficiaries.length >= maxBeneficiaries;
  const noneLeft = remainingBps <= 0;
  const listed = new Set(beneficiaries.map((b) => b.userId));

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
  const searching = query.length >= LOOKUP_MIN && !current;

  /** Re-read after every change: the API recomputes remaining and gross. */
  async function reload() {
    setData(await apiFetch<ApiBeneficiaries>(path, { auth: true }));
  }

  function shareProblem(input: string, maxBps: number): string | null {
    if (!input.trim()) return "Enter a share.";
    const bps = percentToBps(input);
    if (bps === null) return "Enter a percentage from 0.01 to 100, up to two decimals.";
    if (bps > maxBps) return `Only ${percentLabel(bpsToPercent(maxBps))} of your cut is left to give.`;
    return null;
  }

  async function add() {
    if (!picked) return;
    const problem = shareProblem(addShare, remainingBps);
    if (problem) return setAddError(problem);
    setAdding(true);
    setAddError(null);
    try {
      await apiFetch(path, {
        method: "POST",
        auth: true,
        body: { userId: picked.id, shareBps: percentToBps(addShare) },
        timeout: 45_000,
      });
      await reload();
      toast(`${picked.name} now gets ${percentLabel(Number(addShare))} of your cut.`);
      setPicked(null);
      setSearch("");
      setAddShare("");
    } catch (err) {
      setAddError(message(err, "Couldn't add them. Try again."));
    } finally {
      setAdding(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const problem = shareProblem(editShare, remainingBps + editing.shareBps);
    if (problem) return setEditError(problem);
    setSaving(true);
    setEditError(null);
    try {
      await apiFetch(`${path}/${encodeURIComponent(editing.id)}`, {
        method: "PATCH",
        auth: true,
        body: { shareBps: percentToBps(editShare) },
        timeout: 45_000,
      });
      await reload();
      toast(`${editing.name}'s share is now ${percentLabel(Number(editShare))} of your cut.`);
      setEditing(null);
    } catch (err) {
      setEditError(message(err, "Couldn't change the share. Nothing was changed."));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await apiFetch(`${path}/${encodeURIComponent(removing.id)}`, {
        method: "DELETE",
        auth: true,
        timeout: 45_000,
      });
      await reload();
      toast(`${removing.name} no longer shares in new sales.`);
      setRemoving(null);
    } catch (err) {
      setRemoveError(message(err, "Couldn't remove them. Try again."));
    } finally {
      setRemoveBusy(false);
    }
  }

  const addBps = percentToBps(addShare);
  const editBps = percentToBps(editShare);

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-label text-text-dim">
        Share this event&apos;s money with a partner: a co-host, a venue, an
        artist. Shares are a percentage of <span className="text-text">your cut</span>{" "}
        (you keep {percentLabel(organizerSharePercent)} of each sale after the
        platform fee), and apply to new sales only. Partners get no access to
        your event.
      </p>

      <dl className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-card border border-border bg-surface p-4">
          <dt className="text-helper text-text-faint">Shared</dt>
          <dd className="text-section font-bold tabular-nums text-text">
            {percentLabel(bpsToPercent(BPS_TOTAL - remainingBps))}
          </dd>
          <dd className="text-helper text-text-faint">of your cut</dd>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <dt className="text-helper text-text-faint">You keep</dt>
          <dd className="text-section font-bold tabular-nums text-text">
            {percentLabel(bpsToPercent(remainingBps))}
          </dd>
          <dd className="text-helper text-text-faint">
            of your cut · {percentLabel(grossPercentOf(bpsToPercent(remainingBps), organizerSharePercent))} of each sale
          </dd>
        </div>
      </dl>

      <section aria-labelledby="partners" className="flex flex-col gap-3">
        <h2 id="partners" className="text-section font-bold text-text">
          Partners{beneficiaries.length ? ` · ${beneficiaries.length} of ${maxBeneficiaries}` : ""}
        </h2>
        {beneficiaries.length === 0 ? (
          <p className="rounded-card border border-dashed border-border px-5 py-8 text-center text-label text-text-faint">
            No partners. You keep your whole cut.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {beneficiaries.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body text-text">{b.name}</p>
                  <p className="truncate text-helper text-text-faint">{b.email ?? "No email on account"}</p>
                </div>
                <div className="flex items-baseline gap-2 sm:flex-col sm:items-end sm:gap-0">
                  <span className="text-body font-bold tabular-nums text-text">
                    {percentLabel(b.sharePercent)} <span className="text-helper font-normal text-text-faint">of your cut</span>
                  </span>
                  <span className="text-helper tabular-nums text-text-dim">{percentLabel(b.grossPercent)} of each sale</span>
                </div>
                {closed ? null : (
                  <div className="-ml-3 flex gap-1 sm:ml-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(b);
                        setEditShare(String(b.sharePercent));
                        setEditError(null);
                      }}
                      className="inline-flex min-h-10 items-center rounded-full px-3 text-label text-text-dim hover:bg-surface-strong hover:text-text"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRemoving(b);
                        setRemoveError(null);
                      }}
                      aria-label={`Remove ${b.name}`}
                      className="inline-flex min-h-10 items-center rounded-full px-3 text-label text-text-faint hover:bg-danger/10 hover:text-danger"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="partner-add" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:p-5">
        <h2 id="partner-add" className="text-section font-bold text-text">Add a partner</h2>
        {closed ? (
          <p className="text-label text-text-dim">This event is over, so its split can&apos;t change.</p>
        ) : full ? (
          <p className="text-label text-text-dim">
            That&apos;s the most partners an event can have ({maxBeneficiaries}). Remove one to add another.
          </p>
        ) : noneLeft ? (
          <p className="text-label text-text-dim">
            You&apos;ve shared all of your cut. Lower someone&apos;s share to add another partner.
          </p>
        ) : picked ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <div className="flex items-center justify-between gap-3 rounded-control border border-accent-tint-border bg-accent-tint px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-body font-bold text-text">{picked.name}</p>
                <p className="truncate text-helper text-text-dim">{picked.email ?? "No email on account"}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPicked(null);
                  setAddError(null);
                }}
                disabled={adding}
                className="inline-flex min-h-10 shrink-0 items-center rounded-full px-3 text-label text-text-dim hover:text-text disabled:opacity-45"
              >
                Change
              </button>
            </div>
            <Field
              label="Share of your cut (%)"
              hint={`up to ${percentLabel(bpsToPercent(remainingBps))}`}
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 20"
              value={addShare}
              onChange={(e) => {
                setAddShare(e.target.value);
                setAddError(null);
              }}
              error={addError ?? undefined}
            />
            {addBps ? (
              <p className="text-helper text-text-dim">
                {percentLabel(bpsToPercent(addBps))} of your cut is about{" "}
                <span className="text-text">
                  {percentLabel(grossPercentOf(bpsToPercent(addBps), organizerSharePercent))} of each sale
                </span>
                . Applies to sales from now on.
              </p>
            ) : null}
            <Button type="submit" disabled={adding} className="w-full sm:w-fit">
              {adding ? <Spinner /> : null}
              Add partner
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="partner-search" className="text-label text-text-dim">
              Their CrowdPass account, by name or email
            </label>
            <input
              id="partner-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="e.g. tunde@example.com"
              className="h-12 w-full rounded-control border border-border bg-bg px-4 text-body text-text placeholder:text-text-faint"
            />
            {query.length > 0 && query.length < LOOKUP_MIN ? (
              <p className="text-helper text-text-faint">Keep typing…</p>
            ) : searching ? (
              <p className="text-helper text-text-faint">Searching…</p>
            ) : current?.error ? (
              <p role="alert" className="text-label text-danger">{current.error}</p>
            ) : results && results.length === 0 ? (
              <p className="text-label text-text-faint">
                No CrowdPass account matches “{query}”. They need to sign up first.
              </p>
            ) : results ? (
              <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
                {results.map((u) => {
                  const self = u.id === selfId;
                  const already = listed.has(u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        disabled={self || already}
                        onClick={() => {
                          setPicked(u);
                          setAddError(null);
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
                            {self ? "That's you" : "Already a partner"}
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

      <Sheet open={!!editing} title={`Change ${editing?.name ?? ""}'s share`} onClose={() => !saving && setEditing(null)}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveEdit();
          }}
        >
          <p className="text-label text-text-dim">
            Now {editing ? percentLabel(editing.sharePercent) : ""} of your cut. The
            new share applies to sales from now on. What they&apos;ve already
            earned doesn&apos;t change.
          </p>
          <Field
            label="Share of your cut (%)"
            hint={editing ? `up to ${percentLabel(bpsToPercent(remainingBps + editing.shareBps))}` : undefined}
            inputMode="decimal"
            autoComplete="off"
            value={editShare}
            onChange={(e) => {
              setEditShare(e.target.value);
              setEditError(null);
            }}
            error={editError ?? undefined}
          />
          {editBps ? (
            <p className="text-helper text-text-dim">
              About {percentLabel(grossPercentOf(bpsToPercent(editBps), organizerSharePercent))} of each sale.
            </p>
          ) : null}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? <Spinner /> : null}
            Save share
          </Button>
        </form>
      </Sheet>

      <ConfirmDialog
        open={!!removing}
        tone="danger"
        title={`Remove ${removing?.name ?? "them"}?`}
        confirmLabel="Remove partner"
        busy={removeBusy}
        error={removeError}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      >
        <p>
          They stop sharing in sales from now on. What they&apos;ve already earned
          from this event stays theirs.
        </p>
        <p>You can add them back later.</p>
      </ConfirmDialog>
    </div>
  );
}
