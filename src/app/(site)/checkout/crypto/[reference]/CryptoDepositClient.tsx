"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { fetchTicketByReference, verifyPayment } from "@/lib/crowdpass";
import type { CryptoDeposit } from "@/lib/crypto-deposit";
import { chainInfo, explorerLinks, shortHash } from "@/lib/onchain";
import {
  getPendingPurchaseServerSnapshot,
  getPendingPurchaseSnapshot,
  subscribePendingPurchase,
} from "@/lib/pending";
import { useHydrated } from "@/lib/use-hydrated";
import { BrandSpinner } from "@/components/BrandSpinner";
import { Mascot } from "@/components/Mascot";
import { TicketQr } from "@/components/TicketQr";
import { useToast } from "@/components/Toast";
import { ClockIcon, CopyIcon, ExternalLinkIcon, InfoIcon } from "@/components/icons";
import { Button, ButtonLink, Card, Container, Spinner } from "@/components/ui";

/** Mobile's cadence. Settlement arrives by Circle webhook; we can only poll. */
const POLL_MS = 12_000;
/** Keep watching this long past expiry — a deposit sent at 59:59 still lands. */
const GRACE_AFTER_EXPIRY_MS = 15 * 60 * 1000;
/** With no expiry to go on, stop auto-polling after this. */
const GIVE_UP_WITHOUT_EXPIRY_MS = 60 * 60 * 1000;

type Outcome = "waiting" | "paid" | "cancelled";

export function CryptoDepositClient({ reference }: { reference: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const pending = useSyncExternalStore(
    subscribePendingPurchase,
    getPendingPurchaseSnapshot,
    getPendingPurchaseServerSnapshot,
  );
  // Only the order this browser started for THIS reference counts.
  const order = pending?.reference === reference ? pending : null;
  const deposit = order?.crypto ?? null;
  const ticketReference = order?.ticketReference ?? null;

  const [outcome, setOutcome] = useState<Outcome>("waiting");
  const [stalled, setStalled] = useState(false);
  const [checking, setChecking] = useState(false);
  const startedAt = useRef(0);

  /**
   * Paid when the ticket is CONFIRMED (mobile's signal) or the transaction
   * verifies as SUCCESS — whichever lands first. Verify is idempotent and
   * only its SUCCESS is acted on: anything else says nothing certain about a
   * deposit that may still be in flight.
   */
  const check = useCallback(async (): Promise<Outcome> => {
    setChecking(true);
    try {
      const [ticket, tx] = await Promise.all([
        ticketReference ? fetchTicketByReference(ticketReference).catch(() => null) : null,
        verifyPayment(reference).catch(() => null),
      ]);
      if (ticket?.status === "CONFIRMED" || ticket?.status === "USED" || tx?.status === "SUCCESS") {
        return "paid";
      }
      if (ticket?.status === "CANCELLED" || ticket?.status === "REFUNDED") return "cancelled";
      return "waiting";
    } finally {
      setChecking(false);
    }
  }, [reference, ticketReference]);

  const settle = useCallback(
    (next: Outcome) => {
      if (next === "waiting") return;
      setOutcome(next);
      if (next === "paid") {
        router.replace(
          ticketReference
            ? `/tickets/${encodeURIComponent(ticketReference)}?celebrate=1`
            : `/checkout/callback?reference=${encodeURIComponent(reference)}`,
        );
      }
    },
    [router, reference, ticketReference],
  );

  useEffect(() => {
    if (!hydrated || outcome !== "waiting" || stalled) return;
    if (startedAt.current === 0) startedAt.current = Date.now();
    const stopAt = deposit?.expiresAt
      ? new Date(deposit.expiresAt).getTime() + GRACE_AFTER_EXPIRY_MS
      : startedAt.current + GIVE_UP_WITHOUT_EXPIRY_MS;

    let cancelled = false;
    let timer: number | undefined;
    const tick = async () => {
      const next = await check();
      if (cancelled) return;
      if (next !== "waiting") return settle(next);
      if (Date.now() > stopAt) return setStalled(true);
      timer = window.setTimeout(tick, POLL_MS);
    };
    timer = window.setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [hydrated, outcome, stalled, deposit?.expiresAt, check, settle]);

  const checkNow = async () => {
    const next = await check();
    if (next === "waiting") setStalled(false);
    settle(next);
  };

  if (!hydrated) {
    return (
      <Container className="flex flex-col items-center gap-4 py-10 text-center">
        <BrandSpinner width={88} label="Loading your payment" />
      </Container>
    );
  }

  if (outcome === "paid") {
    return (
      <Container className="flex flex-col items-center gap-4 py-10 text-center">
        <BrandSpinner width={88} label="Payment received, opening your ticket" />
        <p className="text-body text-text-dim">Payment received. Opening your ticket…</p>
      </Container>
    );
  }

  if (outcome === "cancelled") {
    return (
      <Container className="flex flex-col items-center gap-4 py-10 text-center">
        <Mascot pose="error" height={140} />
        <h1 className="text-title font-bold text-text">This order was cancelled</h1>
        <p className="max-w-sm text-body text-text-dim">
          Don&apos;t send USDC to this address. If you already did, contact
          support with reference <span className="font-mono text-text">{reference}</span>.
        </p>
        <ButtonLink href="/" variant="secondary" className="w-full sm:w-auto">
          Back to events
        </ButtonLink>
      </Container>
    );
  }

  if (!deposit) return <NoDeposit reference={reference} checking={checking} onCheck={checkNow} />;

  return (
    <DepositInstructions
      reference={reference}
      eventName={order?.eventName ?? ""}
      deposit={deposit}
      stalled={stalled}
      checking={checking}
      onCheck={checkNow}
    />
  );
}

function DepositInstructions({
  reference,
  eventName,
  deposit,
  stalled,
  checking,
  onCheck,
}: {
  reference: string;
  eventName: string;
  deposit: CryptoDeposit;
  stalled: boolean;
  checking: boolean;
  onCheck: () => void;
}) {
  const toast = useToast();
  const chain = chainInfo(deposit.chain);
  const chainName = chain?.name ?? deposit.chain;
  const left = useCountdown(deposit.expiresAt);
  const expired = left !== null && left <= 0;
  const tokenLink = deposit.usdcAddress
    ? explorerLinks(deposit.chain, { address: deposit.usdcAddress }).address
    : undefined;

  const copy = async (value: string, what: string) => {
    try {
      // Needs HTTPS (or localhost) and this tap — both true here.
      await navigator.clipboard.writeText(value);
      toast(`${what} copied`);
    } catch {
      toast(`Couldn't copy — press and hold the ${what.toLowerCase()} to copy it.`, { tone: "danger" });
    }
  };

  return (
    <Container className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-text">Pay with USDC</h1>
        {eventName ? <p className="text-body text-text-dim">{eventName}</p> : null}
      </header>

      <Card className="flex flex-col overflow-hidden">
        <div className="flex flex-col gap-1 p-5">
          <p className="text-label text-text-dim">Send exactly</p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="break-all text-display font-bold tabular-nums text-text">
              {deposit.amountUsdc}
            </span>
            <span className="text-section font-bold text-text-dim">USDC</span>
            <button
              type="button"
              onClick={() => copy(deposit.amountUsdc, "Amount")}
              className="inline-flex min-h-10 items-center gap-1 rounded-control px-2 text-label text-accent hover:bg-accent/10"
            >
              <CopyIcon width={16} height={16} /> Copy
            </button>
          </div>
          <p className="text-helper text-text-faint">
            On <span className="font-medium text-text-dim">{chainName}</span>. Send
            the full amount — a deposit even slightly short won&apos;t issue a ticket.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 border-t border-border bg-white px-5 py-6">
          {/* White, like the ticket QR: a code needs light quiet-zone contrast. */}
          <TicketQr
            token={deposit.address}
            size={180}
            alt={`QR code of the deposit address on ${chainName}`}
            failedNote="Couldn’t draw the QR code. Copy the address below instead."
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-border p-5">
          <p className="text-label text-text-dim">To this address</p>
          <p className="break-all font-mono text-label text-text">{deposit.address}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto sm:self-start"
            onClick={() => copy(deposit.address, "Address")}
          >
            <CopyIcon width={16} height={16} /> Copy address
          </Button>
        </div>

        <dl className="divide-y divide-border border-t border-border">
          <Row label="Network" value={chainName} />
          <Row
            label="Token"
            value={
              deposit.usdcAddress ? (
                tokenLink ? (
                  <a
                    href={tokenLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono hover:text-accent"
                  >
                    USDC · {shortHash(deposit.usdcAddress)}
                    <ExternalLinkIcon width={14} height={14} />
                  </a>
                ) : (
                  <span className="font-mono">USDC · {shortHash(deposit.usdcAddress)}</span>
                )
              ) : (
                "USDC"
              )
            }
          />
          <Row label="Reference" value={<span className="font-mono">{reference}</span>} />
        </dl>
      </Card>

      <div className="flex items-start gap-3 rounded-card border border-warn/30 bg-warn/10 p-4 text-label text-text">
        <InfoIcon className="mt-0.5 shrink-0 text-warn" />
        <p>
          Only send <strong>USDC on {chainName}</strong>. Another token, or USDC
          on another network, can&apos;t be recovered.
        </p>
      </div>

      <Card className="flex flex-col gap-4 p-5" aria-live="polite">
        {left !== null ? (
          <p className="flex items-center gap-2 text-label text-text-dim">
            <ClockIcon width={18} height={18} className="text-text-faint" />
            {expired ? (
              <span>The deposit window has closed.</span>
            ) : (
              <span>
                Time left to send: <span className="font-mono tabular-nums text-text">{formatLeft(left)}</span>
              </span>
            )}
          </p>
        ) : null}

        {expired ? (
          <p className="text-body text-text-dim">
            If you&apos;ve already sent the USDC, it can still settle — we&apos;re
            still checking. If you haven&apos;t, don&apos;t send to this address:
            go back to the event and start a new purchase.
          </p>
        ) : stalled ? (
          <p className="text-body text-text-dim">
            We&apos;ve stopped checking automatically. If you&apos;ve sent it,
            check again — your ticket is also emailed the moment it settles.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <BrandSpinner width={72} label="Waiting for your deposit" />
            <p className="text-body text-text-dim">
              Waiting for your deposit. This page moves on by itself once it
              arrives — usually within a minute of sending.
            </p>
          </div>
        )}

        <Button
          type="button"
          variant={stalled || expired ? "primary" : "secondary"}
          className="w-full"
          onClick={onCheck}
          disabled={checking}
        >
          {checking ? <Spinner /> : null}
          I&apos;ve sent it — check now
        </Button>
      </Card>
    </Container>
  );
}

/**
 * Opened somewhere other than the browser that started the purchase, or
 * after its record expired. The address is deliberately not recoverable from
 * the URL, so say where to look instead — and still let them check.
 */
function NoDeposit({
  reference,
  checking,
  onCheck,
}: {
  reference: string;
  checking: boolean;
  onCheck: () => void;
}) {
  return (
    <Container className="flex flex-col items-center gap-4 py-10 text-center">
      <Mascot pose="waving" height={140} />
      <h1 className="text-title font-bold text-text">Open this where you started</h1>
      <p className="max-w-sm text-body text-text-dim">
        The deposit details for <span className="font-mono text-text">{reference}</span>{" "}
        are only shown in the browser you bought from. If you&apos;ve already
        paid, check its status here.
      </p>
      <Button type="button" className="w-full sm:w-auto" onClick={onCheck} disabled={checking}>
        {checking ? <Spinner /> : null}
        Check payment status
      </Button>
      <ButtonLink href="/" variant="ghost" className="w-full sm:w-auto">
        Back to events
      </ButtonLink>
    </Container>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3.5">
      <dt className="shrink-0 text-label text-text-faint">{label}</dt>
      <dd className="min-w-0 truncate text-right text-label font-medium text-text">{value}</dd>
    </div>
  );
}

/** Milliseconds until `iso`, ticking each second; null with no deadline. */
function useCountdown(iso: string | null): number | null {
  const deadline = iso ? new Date(iso).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Number.isNaN(deadline)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadline]);
  return Number.isNaN(deadline) ? null : Math.max(0, deadline - now);
}

/** `"14:05"`, or `"1:02:09"` past an hour. */
function formatLeft(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
