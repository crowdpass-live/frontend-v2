"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import {
  CLAIM_UPLOAD_BATCH,
  claimEntriesPath,
  describeParse,
  parseClaimList,
  type ClaimEntryInput,
} from "@/lib/claim-list";
import { count } from "@/lib/metric-format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Badge, Button, cx } from "@/components/ui";
import type { ApiClaimEntry, ApiClaimList, ClaimEntryStatus } from "@/types/api";

const STATUS: Record<ClaimEntryStatus, { label: string; tone: "ok" | "neutral" | "danger" }> = {
  UNCLAIMED: { label: "Not claimed", tone: "neutral" },
  CLAIMED: { label: "Claimed", tone: "ok" },
  LOCKED: { label: "Locked", tone: "danger" },
};

/** Rows rendered at once; search narrows a long list. */
const VISIBLE_ROWS = 200;

export interface MemberTier {
  id: string;
  name: string;
  claimOnly: boolean;
  soldCount: number;
}

function summarize(entries: ApiClaimEntry[]): ApiClaimList["summary"] {
  return {
    total: entries.length,
    claimed: entries.filter((e) => e.status === "CLAIMED").length,
    locked: entries.filter((e) => e.status === "LOCKED").length,
    unclaimed: entries.filter((e) => e.status === "UNCLAIMED").length,
  };
}

function message(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * The dues list behind one members-only ticket type. Ports
 * `v2-mobile/src/screens/ClaimListScreen.js`.
 *
 * **Uploading is one-way.** The first upload to an ordinary tier is the only
 * thing that makes it members-only, and nothing turns that off: checkout
 * refuses the tier for good, at any price. So that first upload asks first,
 * and says so; later uploads to a gated tier just add names (a matric number
 * already on the list only has its name refreshed — its claim or lock is
 * kept).
 *
 * **Locked** means three wrong names against one matric number: a member who
 * mistyped, or someone guessing. Only the organizer can tell which, so
 * unlock is theirs. A claimed entry cannot be removed — it backs a ticket.
 */
export function MemberListManager({
  eventId,
  tier,
  initial,
  editable,
}: {
  eventId: string;
  tier: MemberTier;
  initial: ApiClaimList;
  /** False once the event has ended or been cancelled. */
  editable: boolean;
}) {
  const router = useRouter();
  const path = claimEntriesPath(eventId, tier.id);

  const [entries, setEntries] = useState(initial.entries);
  const summary = useMemo(() => summarize(entries), [entries]);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const [adding, setAdding] = useState(initial.entries.length === 0 && editable);
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseClaimList(text), [text]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [confirmGate, setConfirmGate] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [removing, setRemoving] = useState<ApiClaimEntry | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState<string | null>(null);

  const gated = tier.claimOnly || entries.length > 0;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/\s+/g, "");
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.fullName.toLowerCase().replace(/\s+/g, "").includes(q) ||
        e.matNo.toLowerCase().includes(q),
    );
  }, [entries, search]);

  async function upload(list: ClaimEntryInput[]) {
    setUploading(true);
    setUploadError(null);
    let sent = 0;
    try {
      let result: ApiClaimList | null = null;
      for (let i = 0; i < list.length; i += CLAIM_UPLOAD_BATCH) {
        const batch = list.slice(i, i + CLAIM_UPLOAD_BATCH);
        result = await apiFetch<ApiClaimList>(path, {
          method: "POST",
          auth: true,
          body: { entries: batch },
          timeout: 60_000,
        });
        sent += batch.length;
      }
      if (result) setEntries(result.entries);
      setText("");
      setAdding(false);
      setConfirmGate(false);
      setNotice(
        `${count(list.length)} ${list.length === 1 ? "member" : "members"} uploaded to ${tier.name}.`,
      );
      // The tier picker reads claimOnly from the server; let it catch up.
      router.refresh();
    } catch (err) {
      const base = message(err, "The upload failed. Please try again.");
      setUploadError(
        sent > 0
          ? `${base} The first ${count(sent)} were saved; upload the rest again — names already on the list are not duplicated.`
          : base,
      );
      setConfirmGate(false);
    } finally {
      setUploading(false);
    }
  }

  function startUpload() {
    if (!parsed.entries.length) return;
    // The one-way step gets a confirmation; adding to a gated list does not.
    if (!gated) setConfirmGate(true);
    else void upload(parsed.entries);
  }

  async function unlock(entry: ApiClaimEntry) {
    setUnlocking(entry.id);
    setNotice(null);
    try {
      await apiFetch(`${path}/${encodeURIComponent(entry.id)}/unlock`, {
        method: "PATCH",
        auth: true,
      });
      setEntries((es) =>
        es.map((e) => (e.id === entry.id ? { ...e, status: "UNCLAIMED", failedAttempts: 0 } : e)),
      );
      setNotice(`${entry.fullName} can try claiming again.`);
    } catch (err) {
      setNotice(`Couldn't unlock ${entry.fullName}: ${message(err, "please try again.")}`);
    } finally {
      setUnlocking(null);
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
      });
      setEntries((es) => es.filter((e) => e.id !== removing.id));
      setNotice(`${removing.fullName} is off the list.`);
      setRemoving(null);
    } catch (err) {
      setRemoveError(message(err, "Couldn't remove them. Please try again."));
    } finally {
      setRemoveBusy(false);
    }
  }

  async function loadFile(file: File) {
    // A dues list is text; refuse anything that would be pasted as noise.
    if (file.size > 2_000_000) {
      setUploadError("That file is over 2 MB — is it the right one? Save the sheet as CSV.");
      return;
    }
    setUploadError(null);
    setText(await file.text());
  }

  return (
    <div className="flex flex-col gap-5">
      {!gated ? (
        <p className="rounded-control border border-accent-tint-border bg-accent-tint px-4 py-3 text-label text-text-dim">
          <span className="font-bold text-text">{tier.name}</span> is on open sale.
          Upload a dues list to make it members-only: it comes off sale for good,
          and only people on your list can claim it, free, with their matric
          number and full name.
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="On the list" value={summary.total} />
        <Stat label="Claimed" value={summary.claimed} tone="ok" />
        <Stat label="Not claimed" value={summary.unclaimed} />
        <Stat label="Locked" value={summary.locked} tone={summary.locked ? "danger" : undefined} />
      </dl>

      <p role="status" aria-live="polite" className={cx("text-label text-text-dim", !notice && "sr-only")}>
        {notice}
      </p>

      {editable ? (
        adding ? (
          <section
            aria-label={gated ? "Add members" : "Upload member list"}
            className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-section font-bold text-text">
                {gated ? "Add members" : "Upload member list"}
              </h2>
              <p className="text-helper text-text-faint">
                One person per line: full name and matric number, in any order.
              </p>
            </div>
            <label className="sr-only" htmlFor="member-paste">
              Paste the list
            </label>
            <textarea
              id="member-paste"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              spellCheck={false}
              placeholder={"Paste from a spreadsheet or WhatsApp, e.g.\nAda Obi\tCSC/2021/041\nKemi Adeyemi, CSC/2021/042"}
              className="min-h-40 w-full resize-y rounded-control border border-border bg-bg px-4 py-3 font-mono text-label text-text placeholder:text-text-faint"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void loadFile(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  className="w-auto"
                >
                  Choose a CSV file
                </Button>
                {text.trim() ? (
                  <span className="text-helper text-text-dim">{describeParse(parsed)}</span>
                ) : null}
              </div>
              <div className="flex gap-2">
                {entries.length ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAdding(false);
                      setUploadError(null);
                    }}
                    className="w-auto"
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  onClick={startUpload}
                  disabled={uploading || parsed.entries.length === 0}
                  className="w-auto"
                >
                  {uploading
                    ? "Uploading…"
                    : `Upload ${parsed.entries.length ? count(parsed.entries.length) : ""} ${parsed.entries.length === 1 ? "member" : "members"}`.replace(/\s+/g, " ")}
                </Button>
              </div>
            </div>

            {parsed.invalid.length ? (
              <details className="text-helper text-text-faint">
                <summary className="cursor-pointer text-text-dim">
                  {parsed.invalid.length} line{parsed.invalid.length === 1 ? "" : "s"} not
                  understood — they will be skipped
                </summary>
                <ul className="mt-2 flex flex-col gap-1 font-mono">
                  {parsed.invalid.slice(0, 20).map((line, i) => (
                    <li key={i} className="truncate">{line}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  Each line needs one name and exactly one matric number. A phone
                  number on the same line reads as a second number.
                </p>
              </details>
            ) : null}

            {parsed.entries.length ? (
              <details className="text-helper text-text-faint">
                <summary className="cursor-pointer text-text-dim">Preview what will be uploaded</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {parsed.entries.slice(0, 10).map((e) => (
                    <li key={e.matNo} className="flex justify-between gap-4">
                      <span className="truncate text-text-dim">{e.fullName}</span>
                      <span className="shrink-0 font-mono">{e.matNo}</span>
                    </li>
                  ))}
                  {parsed.entries.length > 10 ? (
                    <li>…and {count(parsed.entries.length - 10)} more</li>
                  ) : null}
                </ul>
              </details>
            ) : null}

            {uploadError ? (
              <p role="alert" className="text-label text-danger">{uploadError}</p>
            ) : null}
          </section>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)} className="w-full sm:w-fit">
            Add members
          </Button>
        )
      ) : (
        <p className="text-label text-text-faint">
          This event is over, so its member list can no longer be changed.
        </p>
      )}

      {entries.length ? (
        <section aria-label="Members" className="flex flex-col gap-3">
          <label className="sr-only" htmlFor="member-search">Search the list</label>
          <input
            id="member-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or matric number"
            className="h-10 w-full rounded-control border border-border bg-surface px-4 text-body text-text placeholder:text-text-faint"
          />

          {visible.length === 0 ? (
            <p className="py-6 text-center text-label text-text-faint">
              No one on the list matches “{search}”.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
              {visible.slice(0, VISIBLE_ROWS).map((e) => {
                const st = STATUS[e.status] ?? { label: e.status, tone: "neutral" as const };
                return (
                  <li
                    key={e.id}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
                  >
                    {/* Phones: name and status on one line, the actions on
                        their own below, so neither squeezes the name. */}
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-body text-text">{e.fullName}</p>
                        <p className="font-mono text-helper text-text-faint">
                          {e.matNo}
                          {e.status !== "CLAIMED" && e.failedAttempts > 0
                            ? ` · ${e.failedAttempts} wrong attempt${e.failedAttempts === 1 ? "" : "s"}`
                            : ""}
                        </p>
                      </div>
                      <Badge tone={st.tone} className="shrink-0">{st.label}</Badge>
                    </div>
                    {editable && e.status !== "CLAIMED" ? (
                      <div className="-ml-3 flex items-center gap-1 sm:ml-0 sm:shrink-0">
                        {e.status === "LOCKED" ? (
                          <button
                            type="button"
                            onClick={() => unlock(e)}
                            disabled={unlocking === e.id}
                            className="h-10 rounded-full px-3 text-label font-bold text-accent hover:bg-accent-tint disabled:opacity-45"
                          >
                            {unlocking === e.id ? "Unlocking…" : "Unlock"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setRemoveError(null);
                            setRemoving(e);
                          }}
                          aria-label={`Remove ${e.fullName}`}
                          className="h-10 rounded-full px-3 text-label text-text-faint hover:bg-danger/10 hover:text-danger"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {visible.length > VISIBLE_ROWS ? (
            <p className="text-center text-helper text-text-faint">
              Showing {count(VISIBLE_ROWS)} of {count(visible.length)} — search to find someone.
            </p>
          ) : null}
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmGate}
        title={`Make ${tier.name} members-only?`}
        confirmLabel="Make members-only"
        busy={uploading}
        error={uploadError}
        onConfirm={() => void upload(parsed.entries)}
        onCancel={() => setConfirmGate(false)}
      >
        <p>
          It comes off sale <strong className="text-text">for good</strong> — nobody
          can buy it, at any price, and this can&apos;t be undone.
        </p>
        <p>
          The {count(parsed.entries.length)} {parsed.entries.length === 1 ? "person" : "people"} on
          your list claim it free with their matric number and full name.
          {tier.soldCount
            ? ` The ${count(tier.soldCount)} already sold stay valid.`
            : ""}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing?.fullName ?? "this member"}?`}
        confirmLabel="Remove"
        tone="danger"
        busy={removeBusy}
        error={removeError}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      >
        <p>
          <span className="font-mono">{removing?.matNo}</span> will no longer be able
          to claim a ticket. You can add them back by uploading them again.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "danger";
}) {
  return (
    <div className="rounded-card border border-border bg-surface px-4 py-3">
      <dt className="text-helper text-text-faint">{label}</dt>
      <dd
        className={cx(
          "text-section font-bold tabular-nums",
          tone === "ok" ? "text-ok" : tone === "danger" ? "text-danger" : "text-text",
        )}
      >
        {count(value)}
      </dd>
    </div>
  );
}
