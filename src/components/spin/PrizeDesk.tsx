"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  fetchPrizeSummary,
  fetchWinners,
  formatClaimCode,
  fulfilClaim,
  lookupClaim,
  type PrizeClaim,
  type PrizeSummary,
} from "@/lib/spin-wheel";
import { formatTime } from "@/lib/format";
import { QrScanner } from "@/components/door/QrScanner";
import { Badge, Button, Card, ErrorNote, Spinner, cx } from "@/components/ui";

type Mode = "scan" | "code" | "airtime";

const TABS: [Mode, string][] = [
  ["scan", "Scan"],
  ["code", "Type code"],
  ["airtime", "Airtime"],
];

/** Refresh the stock strip this often while the desk is open. */
const SUMMARY_POLL_MS = 20_000;

function message(err: unknown): string {
  if (err instanceof ApiError && err.status === 0) {
    return "No connection. Nothing was changed. Try again when you have signal.";
  }
  if (err instanceof ApiError && err.status === 404) return "No prize matches that code.";
  return err instanceof ApiError ? err.message : "Something went wrong. Try again.";
}

/**
 * The booth: look a winner's code up (scan their screen or type it), then hand
 * the prize over. Like the door, it is always two steps, look up then hand
 * over, so staff see who and what before anything changes. Airtime has its
 * own tab: it is topped up by hand from the list, then marked sent.
 */
export function PrizeDesk({ campaignId }: { campaignId: string }) {
  const [mode, setMode] = useState<Mode>("scan");
  const [summary, setSummary] = useState<PrizeSummary | null>(null);
  const [claim, setClaim] = useState<PrizeClaim | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justHanded, setJustHanded] = useState(false);
  const [code, setCode] = useState("");

  const refresh = useCallback(() => {
    fetchPrizeSummary(campaignId).then(setSummary, () => undefined);
  }, [campaignId]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, SUMMARY_POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const reset = () => {
    setClaim(null);
    setError(null);
    setJustHanded(false);
    setCode("");
  };

  const look = useCallback(
    async (raw: string) => {
      setBusy(true);
      setError(null);
      setJustHanded(false);
      try {
        setClaim(await lookupClaim(campaignId, raw.trim()));
      } catch (err) {
        setError(message(err));
      } finally {
        setBusy(false);
      }
    },
    [campaignId],
  );

  async function handOver() {
    if (!claim?.claimCode) return;
    setBusy(true);
    setError(null);
    try {
      setClaim(await fulfilClaim(campaignId, claim.claimCode));
      setJustHanded(true);
      refresh();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <StockStrip summary={summary} />

      <div
        role="tablist"
        aria-label="Prize desk"
        className="grid grid-cols-3 gap-1 rounded-full border border-border bg-surface p-1"
      >
        {TABS.map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              reset();
            }}
            className={cx(
              "min-h-10 whitespace-nowrap rounded-full px-2 text-label font-medium transition-colors",
              mode === m ? "bg-surface-strong text-text" : "text-text-dim hover:text-text",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "airtime" ? (
        <AirtimeList campaignId={campaignId} onChanged={refresh} />
      ) : claim ? (
        <ClaimPanel
          claim={claim}
          busy={busy}
          error={error}
          justHanded={justHanded}
          onHandOver={handOver}
          onNext={reset}
        />
      ) : (
        <>
          {mode === "scan" ? (
            <QrScanner paused={busy} onCode={look} />
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) look(code);
              }}
            >
              <label htmlFor="prize-code" className="text-label text-text-dim">
                Claim code on the winner&rsquo;s screen
              </label>
              <input
                id="prize-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="ABC-123"
                className="h-14 w-full rounded-control border border-border bg-surface px-4 font-mono text-body uppercase text-text placeholder:text-text-faint"
              />
              <Button type="submit" disabled={busy || !code.trim()} className="w-full">
                {busy ? <Spinner /> : null} Look up
              </Button>
            </form>
          )}
          {busy && mode === "scan" ? (
            <p className="flex items-center gap-2 text-label text-text-dim" role="status">
              <Spinner /> Looking up…
            </p>
          ) : null}
          <ErrorNote>{error}</ErrorNote>
        </>
      )}
    </div>
  );
}

function StockStrip({ summary }: { summary: PrizeSummary | null }) {
  if (!summary) {
    return <div className="h-24 animate-pulse rounded-card bg-surface" aria-hidden />;
  }
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label text-text-dim">
          <span className="font-bold tabular-nums text-text">{summary.totalSpins}</span> spins
        </p>
        <Badge tone={summary.state === "OPEN" ? "ok" : "neutral"}>
          {summary.state === "OPEN" ? "Wheel open" : summary.state === "UPCOMING" ? "Not open yet" : "Closed"}
        </Badge>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {summary.prizes.map((p) => (
          <li key={p.id} className="min-w-0">
            <p className="truncate text-helper text-text-dim">{p.label}</p>
            <p className="text-label tabular-nums text-text">
              <span className="font-bold">{p.stock - p.won}</span>
              <span className="text-text-faint"> left of {p.stock}</span>
            </p>
            <p className="text-helper tabular-nums text-text-faint">
              {p.handedOver}/{p.won} {p.kind === "AIRTIME" ? "sent" : "handed over"}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ClaimPanel({
  claim,
  busy,
  error,
  justHanded,
  onHandOver,
  onNext,
}: {
  claim: PrizeClaim;
  busy: boolean;
  error: string | null;
  justHanded: boolean;
  onHandOver: () => void;
  onNext: () => void;
}) {
  const done = claim.status === "FULFILLED";
  const airtime = claim.prize?.kind === "AIRTIME";
  return (
    <div
      role="status"
      aria-live="assertive"
      className={cx(
        "flex flex-col gap-4 rounded-card border-2 p-5",
        justHanded ? "border-ok bg-ok/10" : done ? "border-warn bg-warn/10" : "border-border bg-surface",
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="text-label text-text-dim">{claim.winnerName || "Winner"}</p>
        <p className="text-title font-bold text-text">{claim.prize?.label ?? "No prize"}</p>
        {claim.claimCode ? (
          <p className="font-mono text-label text-text-faint">{formatClaimCode(claim.claimCode)}</p>
        ) : null}
      </div>

      {justHanded ? (
        <p className="text-body font-bold text-ok">Handed over. Next winner!</p>
      ) : done ? (
        <p className="text-body font-bold text-warn">
          Already {airtime ? "sent" : "collected"}
          {claim.fulfilledAt ? ` at ${formatTime(claim.fulfilledAt)}` : ""}. Don&rsquo;t hand it over again.
        </p>
      ) : airtime ? (
        <p className="text-body text-text-dim">
          Airtime is sent from the Airtime tab
          {claim.airtimePhone ? ` to ${claim.airtimePhone}` : ". They haven’t entered a number yet"}.
        </p>
      ) : null}

      <ErrorNote>{error}</ErrorNote>

      {!done && !airtime ? (
        <Button onClick={onHandOver} disabled={busy} className="w-full">
          {busy ? <Spinner /> : null} Hand over {claim.prize?.label}
        </Button>
      ) : null}
      <Button variant="secondary" onClick={onNext} className="w-full">
        Next winner
      </Button>
    </div>
  );
}

function AirtimeList({ campaignId, onChanged }: { campaignId: string; onChanged: () => void }) {
  const [rows, setRows] = useState<PrizeClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchWinners(campaignId, "AIRTIME").then(
      (r) => {
        setRows(r);
        setError(null);
      },
      (err) => setError(message(err)),
    );
  }, [campaignId]);

  useEffect(load, [load]);

  async function markSent(code: string) {
    setBusyCode(code);
    setError(null);
    try {
      const updated = await fulfilClaim(campaignId, code);
      setRows((rs) => rs?.map((r) => (r.claimCode === code ? updated : r)) ?? null);
      onChanged();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusyCode(null);
    }
  }

  if (!rows) {
    return error ? <ErrorNote>{error}</ErrorNote> : (
      <p className="flex items-center gap-2 text-label text-text-dim"><Spinner /> Loading…</p>
    );
  }

  // Ready to send first (number given, not sent), then waiting on a number,
  // then done; newest first within each, as the API returns them.
  const rank = (r: PrizeClaim) => (r.status === "FULFILLED" ? 2 : r.airtimePhone ? 0 : 1);
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b));
  const owed = sorted.filter((r) => r.status !== "FULFILLED");
  const owedTotal = owed.reduce((n, r) => n + (r.airtimePhone ? r.prize?.airtimeAmount ?? 0 : 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label text-text-dim">
          To send: <span className="font-bold tabular-nums text-text">₦{owedTotal.toLocaleString("en-NG")}</span>
        </p>
        <Button size="sm" variant="secondary" onClick={load} className="w-auto">
          Refresh
        </Button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {rows.length === 0 ? (
        <p className="text-body text-text-dim">No airtime winners yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((r) => {
            const sent = r.status === "FULFILLED";
            return (
              <li key={r.id}>
                <Card className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-body font-semibold text-text">
                      ₦{(r.prize?.airtimeAmount ?? 0).toLocaleString("en-NG")} · {r.winnerName || "Winner"}
                    </p>
                    <p className="truncate font-mono text-label text-text-dim">
                      {r.airtimePhone ?? "Number not entered yet"}
                    </p>
                  </div>
                  {sent ? (
                    <Badge tone="ok">Sent</Badge>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => r.claimCode && markSent(r.claimCode)}
                      disabled={!r.airtimePhone || busyCode === r.claimCode}
                      className="w-auto shrink-0"
                    >
                      {busyCode === r.claimCode ? <Spinner /> : null} Mark sent
                    </Button>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
