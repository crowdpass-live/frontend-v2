"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchTicketByReference } from "@/lib/crowdpass";
import type { TicketStatus } from "@/types/api";
import { BrandSpinner } from "./BrandSpinner";
import { CheckIcon } from "./icons";
import { Button, Spinner, cx } from "./ui";

/**
 * The wait between "paid" and "here is your ticket".
 *
 * A paid ticket is not CONFIRMED when the payment settles. The payment webhook
 * marks the *transaction* SUCCESS and enqueues a mint; the ticket itself stays
 * PENDING until `MintFinalizerService.finalize` reads the `tokenId` off the
 * mint receipt and flips it to CONFIRMED, with the QR issued right after. The
 * mint queue retries five times with exponential backoff from 10s, so the
 * window is seconds normally and around three minutes at worst.
 *
 * The callback page links here the moment the transaction is SUCCESS, so most
 * buyers land inside that window. The page used to show a static "Pending
 * payment" — wrong for someone whose payment just cleared — and only a manual
 * refresh would reveal the ticket. This polls the public lookup instead and,
 * the moment the ticket leaves PENDING, re-runs the server component so the
 * whole page re-renders as whatever the ticket became: the QR (with the
 * confetti, for a buyer arriving from checkout) or a cancelled note.
 *
 * `paid` is only a hint for the copy. The public lookup does not expose the
 * transaction, so a PENDING ticket opened any other way may genuinely be
 * unpaid — a bank transfer still clearing — and the copy has to be true then
 * too. Nor does it promise the reference works at the door: check-in rejects
 * anything that is not CONFIRMED.
 */

/** Tight at first — the mint usually lands in seconds — then backing off. */
function delayFor(elapsedMs: number): number {
  if (elapsedMs < 30_000) return 3_000;
  if (elapsedMs < 120_000) return 5_000;
  return 10_000;
}

/** Past the mint queue's worst case. The buyer can still ask again by hand. */
const GIVE_UP_AFTER_MS = 5 * 60 * 1000;

/** When the copy admits this is slower than usual. */
const SLOW_AFTER_MS = 60_000;

/**
 * Eases toward 90% and never past it: the bar may not claim done until the
 * ticket actually is. ~60% at 45s, ~80% at 90s.
 */
function progressFor(elapsedMs: number): number {
  return 8 + 82 * (1 - Math.exp(-elapsedMs / 45_000));
}

type StepState = "done" | "active" | "todo";

export function PendingTicket({
  reference,
  paid,
}: {
  reference: string;
  /** Arrived from a SUCCESS payment result, so the money is known to be in. */
  paid: boolean;
}) {
  const router = useRouter();
  const [opening, startOpening] = useTransition();

  const [arrived, setArrived] = useState<TicketStatus | null>(null);
  const [stalled, setStalled] = useState(false);
  const [checking, setChecking] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Two clocks: `shownAt` drives the progress bar and the "slower than usual"
  // copy and never resets; `pollStartedAt` bounds the polling and restarts on
  // "Check again".
  const shownAt = useRef(0);
  const pollStartedAt = useRef(0);
  const firstDelay = useRef(3_000);
  const timer = useRef<number | undefined>(undefined);
  const inFlight = useRef(false);

  const check = useCallback(async (): Promise<TicketStatus | null> => {
    inFlight.current = true;
    setChecking(true);
    try {
      const fresh = await fetchTicketByReference(reference);
      return fresh.status;
    } catch {
      // A failed poll says nothing about the ticket. Stay quiet and retry.
      return null;
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }, [reference]);

  const open = useCallback(
    (status: TicketStatus) => {
      setArrived(status);
      // Re-run the server component rather than patching this panel: the page
      // around it (badge, header, confetti, NFT row) changes too, and the
      // server render already knows how to draw every status.
      startOpening(() => router.refresh());
    },
    [router],
  );

  useEffect(() => {
    if (stalled) return;
    let cancelled = false;
    const now = Date.now();
    if (shownAt.current === 0) shownAt.current = now;
    if (pollStartedAt.current === 0) pollStartedAt.current = now;

    const tick = async () => {
      // A check is already running — it schedules the next one itself, and a
      // second chain here would double the request rate for good.
      if (inFlight.current) return;
      window.clearTimeout(timer.current);

      const status = await check();
      if (cancelled) return;

      if (status && status !== "PENDING") {
        // Keep polling afterwards: if the refresh somehow renders PENDING
        // again, the next tick simply opens it again.
        open(status);
      } else if (Date.now() - pollStartedAt.current > GIVE_UP_AFTER_MS) {
        setStalled(true);
        return;
      }
      timer.current = window.setTimeout(
        tick,
        delayFor(Date.now() - pollStartedAt.current),
      );
    };

    // A buyer who switched to their banking app or inbox should find the
    // ticket already there when they come back, not one poll interval later.
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Short first wait on arrival — the mint has only just been queued — and
    // immediate after "Check again".
    timer.current = window.setTimeout(tick, firstDelay.current);
    firstDelay.current = 0;

    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [stalled, check, open]);

  // Drives the progress bar. Set from a timer rather than read during render,
  // so rendering stays pure.
  useEffect(() => {
    if (stalled || arrived) return;
    const id = window.setInterval(() => {
      if (shownAt.current) setElapsed(Date.now() - shownAt.current);
    }, 1_000);
    return () => window.clearInterval(id);
  }, [stalled, arrived]);

  const ready = arrived === "CONFIRMED" || arrived === "USED";
  const slow = elapsed > SLOW_AFTER_MS;

  const steps: { label: string; state: StepState }[] = [
    {
      label: paid ? "Payment received" : "Confirming payment",
      state: paid || arrived ? "done" : "active",
    },
    {
      label: "Minting your ticket on-chain",
      state: arrived ? "done" : paid ? "active" : "todo",
    },
    { label: "Ticket ready", state: ready ? "done" : "todo" },
  ];

  let title: string;
  let body: string;
  if (arrived) {
    title = ready ? "Your ticket is ready" : "Your ticket was updated";
    body = "Opening it now…";
  } else if (stalled) {
    title = "Still working on it";
    body = paid
      ? "Your payment is safe. Minting is slower than usual right now — we'll send your ticket to you the moment it's ready."
      : "If you've paid, your ticket will be sent to you the moment it's issued. You don't need to pay again.";
  } else if (paid) {
    title = "Issuing your ticket";
    body = slow
      ? "Taking a little longer than usual — hang tight. Your payment is safe and your ticket will appear here on its own."
      : "Your payment went through. We're minting your ticket on-chain — it will appear here on its own, usually in under a minute.";
  } else {
    title = "Waiting for confirmation";
    body =
      "Once your payment clears and your ticket is minted, it will appear here on its own.";
  }

  return (
    <div className="flex flex-col items-center gap-5 border-t border-border px-5 py-8 text-center">
      {/* Constant label: the spinner is its own `role="status"`, and the copy
       * below is the live region — announcing the title twice is noise. */}
      <BrandSpinner
        width={84}
        label="Preparing your ticket"
        className={stalled ? "opacity-50" : undefined}
      />

      <div className="flex flex-col gap-2" aria-live="polite">
        <p className="text-section font-bold text-text">{title}</p>
        <p className="max-w-sm text-body text-text-dim">{body}</p>
      </div>

      {stalled ? null : (
        <div
          aria-hidden
          className="h-1.5 w-full overflow-hidden rounded-full bg-surface-strong"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-out"
            style={{ width: `${arrived ? 100 : progressFor(elapsed)}%` }}
          />
        </div>
      )}

      <ol className="flex w-full flex-col gap-3 text-left">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-3">
            <StepMark state={stalled && step.state === "active" ? "todo" : step.state} />
            <span
              className={cx(
                "text-label",
                step.state === "todo" ? "text-text-faint" : "text-text",
                step.state === "active" && "font-bold",
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      <div className="w-full rounded-control border border-border bg-surface-strong px-4 py-3">
        <p className="text-helper text-text-faint">Your reference</p>
        <p className="font-mono text-body font-bold tracking-wide text-text">
          {reference}
        </p>
      </div>

      {stalled ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={checking}
          onClick={() => {
            pollStartedAt.current = Date.now();
            setStalled(false);
          }}
        >
          {checking ? <Spinner /> : null}
          Check again
        </Button>
      ) : arrived ? (
        <p className="flex items-center gap-2 text-helper text-text-faint">
          {opening ? <Spinner /> : null}
          Loading your ticket…
        </p>
      ) : (
        <p className="text-helper text-text-faint">
          {paid
            ? "Keep this page open — no need to refresh or pay again."
            : "Keep this page open — no need to refresh."}
        </p>
      )}
    </div>
  );
}

function StepMark({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ok/15 text-ok">
        <CheckIcon width={14} height={14} strokeWidth={2.5} />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center text-accent">
        <Spinner />
      </span>
    );
  }
  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      <span className="size-2 rounded-full bg-border" />
    </span>
  );
}
