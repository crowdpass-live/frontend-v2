"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { verifyPayment } from "@/lib/crowdpass";
import { useHydrated } from "@/lib/use-hydrated";
import { money } from "@/lib/format";
import {
  getPendingPurchaseSnapshot,
  getPendingPurchaseServerSnapshot,
  subscribePendingPurchase,
} from "@/lib/pending";
import { CheckIcon } from "@/components/icons";
import {
  Button,
  ButtonLink,
  Card,
  SectionTitle,
  Container,
  Spinner,
} from "@/components/ui";
import type { TransactionStatus } from "@/types/api";

/**
 * Poll cadence. Tight for the first minute — a card payment settles in
 * seconds — then backing off, because bank transfer and USSD legitimately
 * take minutes and a 4s poll for twelve of them is a lot of requests against
 * a Render instance for no gain. Mirrors the mobile app's `FiatPaymentScreen`
 * so the two surfaces behave identically.
 */
function delayFor(elapsedMs: number): number {
  if (elapsedMs < 60_000) return 4_000;
  if (elapsedMs < 180_000) return 8_000;
  if (elapsedMs < 420_000) return 15_000;
  return 30_000;
}

/** Stop polling automatically; the buyer can still ask again by hand. */
const GIVE_UP_AFTER_MS = 12 * 60 * 1000;

export function CallbackClient() {
  const params = useSearchParams();

  // The order this browser last started. Read through the store rather than
  // in an effect so the server render and the first client render agree, and
  // so clearing it on success propagates without a second setState.
  const pending = useSyncExternalStore(
    subscribePendingPurchase,
    getPendingPurchaseSnapshot,
    getPendingPurchaseServerSnapshot,
  );

  // Providers disagree on the parameter name: Paystack sends `reference` and
  // `trxref`, Monnify sends `paymentReference`. The remembered order covers a
  // buyer who came back without any of them.
  const reference =
    (
      params.get("reference") ??
      params.get("trxref") ??
      params.get("paymentReference") ??
      pending?.reference ??
      ""
    ).trim() || null;

  // Storage is unreadable during the server render, so a buyer relying on the
  // remembered reference would flash the "couldn't find it" state for one
  // frame. Hold the spinner until the client has actually looked.
  const hydrated = useHydrated();

  const [status, setStatus] = useState<TransactionStatus>("PENDING");
  const [stalled, setStalled] = useState(false);
  const [checking, setChecking] = useState(false);

  // Seeded inside the effect, not during render: reading the clock while
  // rendering makes the component non-idempotent, and the value is only ever
  // needed once polling has actually started.
  const startedAt = useRef<number>(0);
  const timer = useRef<number | undefined>(undefined);

  const check = useCallback(async (): Promise<TransactionStatus | null> => {
    if (!reference) return null;
    setChecking(true);
    try {
      const result = await verifyPayment(reference);
      setStatus(result.status);
      return result.status;
    } catch {
      // A failed verify says nothing about the payment — the buyer's money is
      // where it is regardless. Stay quiet and let the next tick try again.
      return null;
    } finally {
      setChecking(false);
    }
  }, [reference]);

  // Auto-poll until the transaction reaches a terminal state.
  useEffect(() => {
    if (!reference || status === "SUCCESS" || status === "FAILED" || stalled) {
      return;
    }
    let cancelled = false;
    if (startedAt.current === 0) startedAt.current = Date.now();

    const tick = async () => {
      const next = await check();
      if (cancelled) return;
      if (next === "SUCCESS" || next === "FAILED") return;
      if (Date.now() - startedAt.current > GIVE_UP_AFTER_MS) {
        setStalled(true);
        return;
      }
      timer.current = window.setTimeout(
        tick,
        delayFor(Date.now() - startedAt.current),
      );
    };

    // First check is immediate: the buyer just came back from a card payment
    // that has almost certainly already settled, and making them watch a
    // spinner for four seconds to be told so is a bad first impression.
    void tick();

    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
    };
  }, [reference, status, stalled, check]);

  // On success the ticket reference is what the buyer actually wants — it
  // comes from the remembered order, since `/payments/verify` returns only the
  // transaction. Derived rather than copied into state so it can't lag a
  // render behind `status`; without it we still confirm and point at the email.
  //
  // The remembered order is deliberately NOT cleared here. Clearing it would
  // notify the store, `pending` would go null on the very next render, and
  // this link would disappear from under the buyer the instant it appeared.
  // It expires on its own via the store's TTL and is overwritten by the next
  // purchase, so there is nothing to clean up.
  const ticketReference =
    status === "SUCCESS" ? (pending?.ticketReference ?? null) : null;

  if (!hydrated) {
    return (
      <Container className="flex flex-col items-center gap-4 text-center">
        <Spinner className="size-8 text-accent" />
      </Container>
    );
  }

  // No reference anywhere — came here directly, or storage was unavailable
  // and the gateway sent nothing. Nothing to poll.
  if (!reference) {
    return (
      <Container className="flex flex-col gap-6 text-center">
        <StatusMark tone="neutral" />
        <div className="flex flex-col gap-2">
          <SectionTitle>We couldn&apos;t find that payment</SectionTitle>
          <p className="text-body text-text-dim">
            If you were charged, your ticket is on its way by email — no need
            to pay again. Check your inbox, including spam.
          </p>
        </div>
        <ButtonLink href="/" variant="secondary" className="w-full">
          Back to CrowdPass
        </ButtonLink>
      </Container>
    );
  }

  if (status === "SUCCESS") {
    return (
      <Container className="flex flex-col gap-6 text-center">
        <StatusMark tone="ok" />
        <div className="flex flex-col gap-2">
          <SectionTitle>You&apos;re in</SectionTitle>
          <p className="text-body text-text-dim">
            {pending?.eventName
              ? `Your ticket to ${pending.eventName} is confirmed.`
              : "Your payment went through and your ticket is confirmed."}{" "}
            We&apos;ve emailed it to you as well.
          </p>
        </div>
        {ticketReference ? (
          <ButtonLink href={`/tickets/${ticketReference}`} className="w-full">
            View my ticket
          </ButtonLink>
        ) : (
          <Card className="p-4 text-left text-label text-text-dim">
            Your ticket and QR code are in the confirmation email. Reference{" "}
            <span className="font-mono text-text">{reference}</span>.
          </Card>
        )}
      </Container>
    );
  }

  if (status === "FAILED") {
    return (
      <Container className="flex flex-col gap-6 text-center">
        <StatusMark tone="danger" />
        <div className="flex flex-col gap-2">
          <SectionTitle>Payment didn&apos;t go through</SectionTitle>
          <p className="text-body text-text-dim">
            Nothing was charged. Your seats have been released — you can try
            again from the event page.
          </p>
        </div>
        {pending?.eventSlug ? (
          <ButtonLink href={`/events/${pending.eventSlug}/checkout`} className="w-full">
            Try again
          </ButtonLink>
        ) : (
          <ButtonLink href="/" className="w-full">
            Back to CrowdPass
          </ButtonLink>
        )}
      </Container>
    );
  }

  // PENDING — the state the design never drew (open issue #11), and the one
  // Nigerian bank transfer and USSD make unavoidable.
  return (
    <Container className="flex flex-col gap-6 text-center">
      <StatusMark tone="warn" pulse={!stalled} />
      <div className="flex flex-col gap-2">
        <SectionTitle>
          {stalled ? "Still waiting on your bank" : "Confirming your payment"}
        </SectionTitle>
        <p className="text-body text-text-dim">
          {stalled
            ? "This is taking longer than usual. Bank transfers can take a while to clear — your ticket will be emailed the moment it does."
            : "Bank transfers and USSD can take a few minutes. Keep this page open — it updates on its own."}
        </p>
      </div>

      <Card className="flex flex-col gap-2 p-4 text-left">
        {pending?.eventName ? (
          <Row label="Event" value={pending.eventName} />
        ) : null}
        {pending?.amount ? (
          <Row
            label="Amount"
            value={money(pending.amount, pending.currency || "NGN")}
          />
        ) : null}
        <Row label="Reference" value={reference} mono />
      </Card>

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
        {checking ? (
          <>
            <Spinner />
            Checking…
          </>
        ) : (
          "Check again"
        )}
      </Button>
    </Container>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-label text-text-faint">{label}</span>
      <span
        className={`min-w-0 truncate text-label text-text ${mono ? "font-mono" : "font-medium"}`}
      >
        {value}
      </span>
    </div>
  );
}

function StatusMark({
  tone,
  pulse,
}: {
  tone: "ok" | "warn" | "danger" | "neutral";
  pulse?: boolean;
}) {
  const tones = {
    ok: "bg-ok/15 text-ok",
    warn: "bg-warn/15 text-warn",
    danger: "bg-danger/15 text-danger",
    neutral: "bg-surface text-text-faint",
  } as const;
  return (
    <div
      className={`mx-auto grid size-20 place-items-center rounded-full ${tones[tone]}`}
    >
      {tone === "ok" ? (
        <CheckIcon width={36} height={36} strokeWidth={2.25} />
      ) : tone === "danger" ? (
        <span aria-hidden className="text-4xl leading-none">
          ×
        </span>
      ) : (
        <Spinner className={`size-8 ${pulse ? "" : "animate-none opacity-60"}`} />
      )}
    </div>
  );
}
