"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTicketByReference } from "@/lib/crowdpass";
import { TicketQr } from "./TicketQr";
import { TicketActions } from "./TicketActions";
import { Button, Spinner } from "./ui";
import { Logo } from "./Logo";

/**
 * The QR panel and its actions — and the wait before either exists.
 *
 * A ticket is `CONFIRMED` the moment payment settles, but `qrCode` is written
 * much later: `MintFinalizerService.issueQrAndNotify` needs the `tokenId` from
 * the on-chain mint receipt, and the mint queue retries five times with
 * exponential backoff from 10s. So there is a real window — seconds to
 * minutes — where the buyer is looking at a paid, confirmed ticket that has no
 * QR yet, and a window where minting fails and one never arrives.
 *
 * The page used to hide the QR *and* the Download/Share buttons in that
 * window, while still saying "Show this QR code at the door". This polls
 * instead, and says what is actually happening.
 *
 * The reassuring part, which the copy leans on because it is true: **check-in
 * does not need the QR.** `verifyTicket` and `checkIn` both look the ticket up
 * by `reference`, and the scanner app has a manual reference entry. A buyer
 * whose mint is slow still gets in.
 */

/** Tight at first — the mint usually lands in seconds — then backing off. */
function delayFor(elapsedMs: number): number {
  if (elapsedMs < 30_000) return 3_000;
  if (elapsedMs < 120_000) return 6_000;
  return 15_000;
}

/** Stop polling on our own; the buyer can still ask again by hand. */
const GIVE_UP_AFTER_MS = 3 * 60 * 1000;

export interface TicketCredentialProps {
  reference: string;
  /** `ticket.qrCode` at render time — null while the mint is still running. */
  initialToken: string | null;
  eventName: string;
  tierName: string;
  whenLabel: string;
  whereLabel: string;
  holder: string;
  shareUrl: string;
}

export function TicketCredential(props: TicketCredentialProps) {
  const { reference, initialToken } = props;

  const [token, setToken] = useState<string | null>(initialToken);
  const [stalled, setStalled] = useState(false);
  const [checking, setChecking] = useState(false);

  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const check = useCallback(async (): Promise<string | null> => {
    setChecking(true);
    try {
      const fresh = await fetchTicketByReference(reference);
      if (fresh.qrCode) {
        setToken(fresh.qrCode);
        return fresh.qrCode;
      }
      return null;
    } catch {
      // A failed poll says nothing about the mint. Stay quiet and retry.
      return null;
    } finally {
      setChecking(false);
    }
  }, [reference]);

  useEffect(() => {
    if (token || stalled) return;
    let cancelled = false;
    if (startedAt.current === 0) startedAt.current = Date.now();

    const tick = async () => {
      const found = await check();
      if (cancelled || found) return;
      if (Date.now() - startedAt.current > GIVE_UP_AFTER_MS) {
        setStalled(true);
        return;
      }
      timer.current = window.setTimeout(
        tick,
        delayFor(Date.now() - startedAt.current),
      );
    };

    timer.current = window.setTimeout(tick, 2_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
    };
  }, [token, stalled, check]);

  // --- the ticket is ready -------------------------------------------------
  if (token) {
    return (
      <>
        <div className="flex flex-col items-center gap-4 border-t border-border bg-white px-5 py-6 sm:py-8">
          {/* On white, deliberately: a QR needs light quiet-zone contrast to
           * scan reliably, and the scanner has under 2s to read it. */}
          <TicketQr token={token} size={220} />
          <p className="font-mono text-label font-bold tracking-wide text-accent-deep">
            {reference}
          </p>
          <Logo variant="mark" height={16} className="opacity-70" />
        </div>
        <div className="border-t border-border p-5">
          <TicketActions
            shareUrl={props.shareUrl}
            ticket={{
              eventName: props.eventName,
              tierName: props.tierName,
              whenLabel: props.whenLabel,
              whereLabel: props.whereLabel,
              holder: props.holder,
              reference: props.reference,
              qrToken: token,
            }}
          />
        </div>
      </>
    );
  }

  // --- paid, but the mint has not landed yet -------------------------------
  return (
    <div className="flex flex-col items-center gap-4 border-t border-border px-5 py-8 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-warn/15 text-warn">
        <Spinner className={stalled ? "size-6 animate-none opacity-60" : "size-6"} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-section font-bold text-text">
          {stalled ? "Still finalising" : "Finalising your ticket"}
        </p>
        <p className="max-w-sm text-body text-text-dim">
          {stalled
            ? "Your ticket is paid for and valid. The QR is taking longer than usual to mint — we'll email it the moment it's ready."
            : "Your payment went through. We're minting your ticket on-chain — the QR code appears here in a moment."}
        </p>
      </div>

      {/* The reference is the point of this screen while there is no QR: it is
       * what actually admits the buyer, so it is shown large rather than
       * tucked into a detail row. */}
      <div className="w-full rounded-control border border-border bg-surface-strong px-4 py-3">
        <p className="text-helper text-text-faint">Your reference</p>
        <p className="font-mono text-body font-bold tracking-wide text-text">
          {reference}
        </p>
      </div>

      <p className="text-helper text-text-faint">
        This works at the door on its own — the team can check you in with the
        reference if the QR isn&apos;t ready.
      </p>

      {stalled ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={checking}
          onClick={() => {
            startedAt.current = Date.now();
            setStalled(false);
            void check();
          }}
        >
          {checking ? <Spinner /> : null}
          Check again
        </Button>
      ) : null}
    </div>
  );
}
