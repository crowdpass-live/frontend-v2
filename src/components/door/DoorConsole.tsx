"use client";

import { useCallback, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import { checkInWindow } from "@/lib/door-window";
import { formatDateTimeLong, formatTime } from "@/lib/format";
import { Button, Spinner, cx } from "@/components/ui";
import { DoorRoster } from "./DoorRoster";
import { QrScanner } from "./QrScanner";
import type { ApiCheckInResult, ApiDoorVerification, ApiResolvedQr } from "@/types/api";

type Mode = "scan" | "code" | "list";

const REF_PREFIX = "CROWDPASS_TKT_";

/** verify's and checkin's wording for "the event is not on right now". */
const OUTSIDE_WINDOW = /not currently active|not within the check-in window/i;

/**
 * A typed ticket code as the API stores it. References are the prefix plus
 * 8 uppercase hex characters, so the 8 alone is enough on a phone keyboard.
 */
function normalizeTyped(raw: string): string {
  const v = raw.trim().toUpperCase().replace(/\s+/g, "");
  return /^[0-9A-F]{8}$/.test(v) ? REF_PREFIX + v : v;
}

type Result =
  | { kind: "working" }
  | { kind: "verified"; ticket: ApiDoorVerification; expiredQr: boolean }
  | { kind: "checked-in"; ticket: ApiCheckInResult }
  /** The ticket was judged and refused (used, wrong event, cancelled…). */
  | { kind: "refused"; message: string; used: boolean; name: string | null; at: string | null }
  /** A good ticket, but the door is not open (before start / after end). */
  | { kind: "not-open"; name: string | null; ticketType: string; reference: string }
  /** The ticket was NOT judged: no connection, unreadable QR, not found. */
  | { kind: "problem"; message: string; offline: boolean };

/** Thrown to stop the session: access to this door was revoked mid-shift. */
class Revoked extends Error {}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Not supported (iOS); the screen carries the result regardless.
  }
}

/**
 * The door: scan, type a code, or pick from the guest list — then verify,
 * then check in. Ports the logic of `CheckInScannerScreen.js` (#47).
 *
 * **Verify, then check in — always two steps.** `verify` is read-only and
 * shows who is being admitted; `checkin` is one-way. A scan never checks
 * anyone in by itself.
 *
 * **Every failure is told apart**, because at a door they mean different
 * things to the person in front of you:
 * - no connection → nothing was judged; say so, never "invalid ticket";
 * - already used → the fraud case this whole surface exists for; loud;
 * - 403 → access was revoked mid-shift; terminal, the session stops;
 * - wrong event, cancelled, refunded, pending → the backend's own sentence.
 */
export function DoorConsole({
  eventId,
  startTime,
  endTime,
}: {
  eventId: string;
  startTime: string;
  endTime: string | null;
}) {
  const [mode, setMode] = useState<Mode>("scan");
  const [result, setResult] = useState<Result | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [code, setCode] = useState("");
  const [admitted, setAdmitted] = useState(0);
  const [rosterKey, setRosterKey] = useState(0);

  const doorWindow = checkInWindow({ startTime, endTime });
  const busy = result?.kind === "working";

  const fail = useCallback((err: unknown, judged: boolean): Result => {
    if (err instanceof ApiError && err.status === 403) throw new Revoked();
    if (err instanceof ApiError && err.status === 0) {
      return {
        kind: "problem",
        offline: true,
        message: "No connection — this ticket hasn't been checked. Try again when you have signal.",
      };
    }
    if (err instanceof ApiError && err.status === 404) {
      return { kind: "problem", offline: false, message: "No ticket matches that code." };
    }
    const message = err instanceof ApiError ? err.message : "Something went wrong. Try again.";
    if (judged) {
      return { kind: "refused", message, used: /already been used/i.test(message), name: null, at: null };
    }
    return {
      kind: "problem",
      offline: false,
      message: /invalid ticket qr/i.test(message)
        ? "That QR isn't a CrowdPass ticket."
        : message,
    };
  }, []);

  /** A scanned string → resolve → verify. A typed or picked reference skips resolve. */
  const examine = useCallback(
    async (input: string, kind: "scan" | "reference") => {
      setResult({ kind: "working" });
      try {
        let reference = input.trim();
        let expiredQr = false;
        if (kind === "scan") {
          // Raw, unparsed: resolve-qr tells a bare reference (app tickets)
          // from a signed htv1 token (web and email) — not the client.
          const resolved = await apiFetch<ApiResolvedQr>("/tickets/resolve-qr", {
            method: "POST",
            auth: true,
            body: { code: input },
          }).catch((err) => {
            throw { stage: "resolve", err };
          });
          reference = resolved.reference;
          expiredQr = resolved.expired;
        }
        const ticket = await apiFetch<ApiDoorVerification>(
          `/tickets/${encodeURIComponent(reference)}/verify`,
          { method: "POST", auth: true, body: { eventId } },
        ).catch((err) => {
          throw { stage: "verify", err };
        });

        if (ticket.valid) {
          buzz(40);
          setResult({ kind: "verified", ticket, expiredQr });
        } else if (ticket.status === "CONFIRMED" && OUTSIDE_WINDOW.test(ticket.message)) {
          // verify answers valid:false outside the window even for a good
          // ticket. "Do not admit" there would send a paying guest away.
          setResult({
            kind: "not-open",
            name: ticket.buyerName,
            ticketType: ticket.ticketType,
            reference: ticket.reference,
          });
        } else {
          buzz([90, 60, 90]);
          setResult({
            kind: "refused",
            message: ticket.message,
            used: ticket.status === "USED",
            name: ticket.buyerName,
            at: ticket.checkedInAt,
          });
        }
      } catch (thrown) {
        const { err } = (thrown ?? {}) as { err?: unknown };
        try {
          buzz([90, 60, 90]);
          setResult(fail(err ?? thrown, false));
        } catch (e) {
          if (e instanceof Revoked) setRevoked(true);
          else throw e;
        }
      }
    },
    [eventId, fail],
  );

  async function admit(reference: string) {
    setResult({ kind: "working" });
    try {
      const ticket = await apiFetch<ApiCheckInResult>(
        `/tickets/${encodeURIComponent(reference)}/checkin`,
        { method: "POST", auth: true, body: { eventId } },
      );
      buzz([40, 40, 120]);
      setAdmitted((n) => n + 1);
      setRosterKey((n) => n + 1);
      setResult({ kind: "checked-in", ticket });
    } catch (err) {
      try {
        buzz([90, 60, 90]);
        // A check-in refusal (already used in the seconds since verify, the
        // window closing) is a judgement, unlike a failure to reach us.
        setResult(fail(err, true));
      } catch (e) {
        if (e instanceof Revoked) setRevoked(true);
        else throw e;
      }
    }
  }

  function next() {
    setResult(null);
    setCode("");
  }

  if (revoked) {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-card border-2 border-danger bg-danger/10 p-6">
        <p className="text-title font-bold text-danger">You can no longer check in guests here</p>
        <p className="text-body text-text-dim">
          The organizer removed your access to this event&apos;s door. Nothing
          else has been checked in. Ask them if this is a mistake.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {doorWindow !== "open" ? (
        <p className="rounded-control border border-warn/40 bg-warn/10 px-4 py-3 text-label text-warn">
          {doorWindow === "upcoming"
            ? `Check-in opens when the event starts — ${formatDateTimeLong(startTime)}. You can look tickets up now, but not admit anyone yet.`
            : "This event has ended, so check-in is closed. You can still look tickets up."}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <div role="tablist" aria-label="How to find the ticket" className="grid grid-cols-3 gap-1 rounded-full border border-border bg-surface p-1">
          {(
            [
              ["scan", "Scan"],
              ["code", "Type code"],
              ["list", "Guest list"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setResult(null);
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
        {admitted ? (
          <p className="text-label text-text-dim" aria-live="polite">
            <span className="font-bold tabular-nums text-text">{admitted}</span> checked in on this
            phone this session
          </p>
        ) : null}
      </div>

      {result ? (
        <ResultCard
          result={result}
          canAdmit={doorWindow === "open"}
          onAdmit={admit}
          onNext={next}
          onRetry={next}
        />
      ) : null}

      {/* Kept mounted while a result shows, but paused: restarting the
          camera for every guest costs a second each time. */}
      {mode === "scan" ? (
        <div className={cx(result && "hidden")}>
          <QrScanner paused={!!result} onCode={(c) => void examine(c, "scan")} />
        </div>
      ) : null}

      {mode === "code" && !result ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void examine(normalizeTyped(code), "reference");
          }}
        >
          <label htmlFor="door-code" className="text-label text-text-dim">
            Ticket code — under the QR and in the confirmation email. The last
            8 characters are enough.
          </label>
          <input
            id="door-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. 3F9A1C07"
            className="h-14 w-full rounded-control border border-border bg-surface px-4 font-mono text-body text-text placeholder:text-text-faint"
          />
          <Button type="submit" disabled={busy || !code.trim()} className="w-full">
            Look up ticket
          </Button>
        </form>
      ) : null}

      {mode === "list" && !result ? (
        <DoorRoster eventId={eventId} refreshKey={rosterKey} onPick={(ref) => void examine(ref, "reference")} />
      ) : null}
    </div>
  );
}

function ResultCard({
  result,
  canAdmit,
  onAdmit,
  onNext,
  onRetry,
}: {
  result: Result;
  canAdmit: boolean;
  onAdmit: (reference: string) => void;
  onNext: () => void;
  onRetry: () => void;
}) {
  if (result.kind === "working") {
    return (
      <div className="grid min-h-48 place-items-center rounded-card border border-border bg-surface" role="status">
        <span className="flex items-center gap-3 text-body text-text-dim">
          <Spinner /> Checking the ticket…
        </span>
      </div>
    );
  }

  if (result.kind === "verified") {
    const t = result.ticket;
    return (
      <div className="flex flex-col gap-4 rounded-card border-2 border-ok bg-ok/10 p-5" role="status" aria-live="assertive">
        <p className="text-label font-bold uppercase tracking-wide text-ok">Valid ticket</p>
        <div>
          <p className="break-words text-display font-bold text-text">{t.buyerName || "No name on ticket"}</p>
          <p className="mt-1 text-body text-text-dim">{t.ticketType}</p>
          <p className="font-mono text-helper text-text-faint">{t.reference}</p>
        </div>
        {result.expiredQr ? (
          <p className="text-label text-warn">
            This is an old QR code. The ticket itself is fine — just check the
            name matches the person.
          </p>
        ) : null}
        {canAdmit ? (
          <Button type="button" onClick={() => onAdmit(t.reference)} className="w-full">
            Check in {t.buyerName ? t.buyerName.split(" ")[0] : "guest"}
          </Button>
        ) : (
          <p className="text-label text-text-dim">Check-in isn&apos;t open right now.</p>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onNext} className="w-full">
          Not them — cancel
        </Button>
      </div>
    );
  }

  if (result.kind === "checked-in") {
    const t = result.ticket;
    return (
      <div className="flex flex-col gap-4 rounded-card border-2 border-ok bg-ok p-5 text-ink" role="status" aria-live="assertive">
        <p className="text-label font-bold uppercase tracking-wide">Checked in</p>
        <div>
          <p className="break-words text-display font-bold">{t.buyerName || "Guest"}</p>
          <p className="mt-1 text-body">{t.ticketType} · {formatTime(t.checkedInAt)}</p>
        </div>
        <Button type="button" variant="secondary" onClick={onNext} className="w-full">
          Next guest
        </Button>
      </div>
    );
  }

  if (result.kind === "not-open") {
    return (
      <div className="flex flex-col gap-4 rounded-card border-2 border-warn bg-warn/10 p-5" role="status">
        <p className="text-label font-bold uppercase tracking-wide text-warn">Ticket is fine — door not open</p>
        <div>
          <p className="break-words text-display font-bold text-text">{result.name || "No name on ticket"}</p>
          <p className="mt-1 text-body text-text-dim">{result.ticketType}</p>
          <p className="mt-2 text-body text-text">
            Check-in only works while the event is on. They can come back once it starts.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={onNext} className="w-full">
          Next guest
        </Button>
      </div>
    );
  }

  if (result.kind === "refused") {
    return (
      <div className="flex flex-col gap-4 rounded-card border-2 border-danger bg-danger/15 p-5" role="alert">
        <p className="text-label font-bold uppercase tracking-wide text-danger">
          {result.used ? "Already checked in" : "Do not admit"}
        </p>
        <div>
          {result.name ? <p className="break-words text-display font-bold text-text">{result.name}</p> : null}
          <p className="mt-1 text-body text-text">
            {result.used && result.at
              ? `This ticket was already used at ${formatTime(result.at)}. It cannot get in twice.`
              : result.message}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={onNext} className="w-full">
          Next guest
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "flex flex-col gap-4 rounded-card border-2 p-5",
        result.offline ? "border-warn bg-warn/10" : "border-border bg-surface",
      )}
      role="alert"
    >
      <p className={cx("text-label font-bold uppercase tracking-wide", result.offline ? "text-warn" : "text-text-dim")}>
        {result.offline ? "No connection" : "Couldn't check that"}
      </p>
      <p className="text-body text-text">{result.message}</p>
      <Button type="button" variant="secondary" onClick={onRetry} className="w-full">
        {result.offline ? "Try again" : "Next guest"}
      </Button>
    </div>
  );
}
