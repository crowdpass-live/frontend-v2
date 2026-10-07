"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { ngn } from "@/lib/metric-format";
import { formatUsdc } from "@/lib/onchain";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { Button, Field, Spinner } from "@/components/ui";

/** `UpdateTicketFeeDto`: naira, ₦500 to ₦500,000. */
const PRICE_MIN = 500;
const PRICE_MAX = 500_000;

export interface PricedTicketType {
  id: string;
  name: string;
  price: number;
}

/** The event's claimable on-chain escrow, summed server-side. */
export interface Claimable {
  /** Exact USDC decimal string; "0" when nothing is claimable. */
  usdc: string;
  /** Some ticket types couldn't be read — the real figure may be higher. */
  partial: boolean;
  /** No figure at all (the chain read failed). */
  unknown: boolean;
}

function message(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 0) {
    return "No connection, so nothing was changed. Try again when you have signal.";
  }
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * The two money actions on a live event (#42).
 *
 * **Price.** `PATCH /organizer/events/:id/tickets/:ticketTypeId/fee`, the
 * only edit a published event allows. It rewrites the on-chain fee, so it is
 * slow and is confirmed first, and it affects new sales only: tickets
 * already bought keep what was paid.
 *
 * **Payout.** `POST /organizer/payouts/request` withdraws the event's USDC
 * escrow to the organizer's CrowdPass wallet. Offered only when the chain
 * says something is claimable (an empty escrow always fails). It settles in
 * the background, so a 200 means *requested*, never *paid*; the result
 * shows up in Payouts.
 */
export function EventMoneyActions({
  eventId,
  canEditPrices,
  ticketTypes,
  claimable,
}: {
  eventId: string;
  canEditPrices: boolean;
  ticketTypes: PricedTicketType[];
  claimable: Claimable;
}) {
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState<PricedTicketType | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [savingPrice, setSavingPrice] = useState(false);

  const [confirmPayout, setConfirmPayout] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  const hasClaimable = !claimable.unknown && Number(claimable.usdc) > 0;
  const paid = ticketTypes.filter((t) => t.price > 0);

  const parsed = Number(priceInput.replace(/[,\s₦]/g, ""));
  const validation =
    !priceInput.trim()
      ? "Enter a price."
      : !Number.isFinite(parsed) || !/^\d+(\.\d{1,2})?$/.test(priceInput.replace(/[,\s₦]/g, ""))
        ? "Enter an amount in naira, e.g. 7500."
        : parsed < PRICE_MIN
          ? `The lowest price is ${ngn(PRICE_MIN)}.`
          : parsed > PRICE_MAX
            ? `The highest price is ${ngn(PRICE_MAX)}.`
            : editing && parsed === editing.price
              ? "That's already the price."
              : null;

  async function savePrice() {
    if (!editing || validation) {
      setPriceError(validation);
      return;
    }
    setSavingPrice(true);
    setPriceError(null);
    try {
      await apiFetch(
        `/organizer/events/${encodeURIComponent(eventId)}/tickets/${encodeURIComponent(editing.id)}/fee`,
        // An on-chain write; publish-length timeout.
        { method: "PATCH", auth: true, body: { priceNgn: parsed }, timeout: 60_000 },
      );
      toast(`${editing.name} now costs ${ngn(parsed)} for new buyers.`);
      setEditing(null);
      router.refresh();
    } catch (err) {
      setPriceError(message(err, "Couldn't change the price. Nothing was changed."));
    } finally {
      setSavingPrice(false);
    }
  }

  async function requestPayout() {
    setRequesting(true);
    setPayoutError(null);
    try {
      await apiFetch("/organizer/payouts/request", {
        method: "POST",
        auth: true,
        body: { eventId },
        timeout: 60_000,
      });
      setConfirmPayout(false);
      toast("Payout requested. It shows in Payouts as it's processed.", { tone: "info" });
      router.refresh();
    } catch (err) {
      setPayoutError(message(err, "Couldn't request the payout. Try again."));
    } finally {
      setRequesting(false);
    }
  }

  if (!canEditPrices && !hasClaimable && claimable.unknown) return null;

  return (
    <section aria-labelledby="money-actions" className="flex flex-col gap-5 rounded-card border border-border bg-surface p-5">
      <h2 id="money-actions" className="text-section font-bold text-text">Prices and payouts</h2>

      {canEditPrices && paid.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-label text-text-dim">
            Price is the one thing you can change on a live event. New buyers pay
            the new price; tickets already sold keep what was paid.
          </p>
          <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
            {paid.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-body text-text">{t.name}</span>
                  <span className="block text-helper tabular-nums text-text-faint">{ngn(t.price)}</span>
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-auto shrink-0"
                  onClick={() => {
                    setEditing(t);
                    setPriceInput(String(t.price));
                    setPriceError(null);
                  }}
                >
                  Change price
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
        <div>
          <p className="text-label text-text-dim">Claimable USDC · on-chain</p>
          <p className="text-title font-bold tabular-nums text-text">
            {claimable.unknown ? "—" : `${claimable.partial ? "At least " : ""}${formatUsdc(claimable.usdc)} USDC`}
          </p>
          <p className="text-helper text-text-faint">
            {claimable.unknown
              ? "Couldn't read the escrow from the chain just now. Refresh to try again."
              : hasClaimable
                ? "Crypto sales held in this event's escrow, ready to withdraw to your CrowdPass wallet."
                : "Nothing to withdraw yet. Crypto sales collect here; card and transfer sales settle to your bank."}
          </p>
        </div>
        {hasClaimable ? (
          <Button type="button" size="sm" className="w-full sm:w-fit" onClick={() => setConfirmPayout(true)}>
            Request payout
          </Button>
        ) : null}
        <Link href="/host/payouts" className="w-fit text-label text-accent hover:text-accent-hi">
          Payout history
        </Link>
      </div>

      <Sheet open={!!editing} title={`Change price · ${editing?.name ?? ""}`} onClose={() => !savingPrice && setEditing(null)}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void savePrice();
          }}
        >
          <p className="text-label text-text-dim">
            Now {editing ? ngn(editing.price) : ""}. The new price applies to new
            sales only, and is written to the blockchain. That takes a few seconds.
          </p>
          <Field
            label="New price (₦)"
            hint={`${ngn(PRICE_MIN)}–${ngn(PRICE_MAX)}`}
            inputMode="decimal"
            autoComplete="off"
            value={priceInput}
            onChange={(e) => {
              setPriceInput(e.target.value);
              setPriceError(null);
            }}
            error={priceError ?? undefined}
          />
          <Button type="submit" disabled={savingPrice} className="w-full">
            {savingPrice ? <Spinner /> : null}
            {savingPrice
              ? "Writing to the blockchain…"
              : !validation
                ? `Change to ${ngn(parsed)}`
                : "Change price"}
          </Button>
        </form>
      </Sheet>

      <ConfirmDialog
        open={confirmPayout}
        title="Request a payout?"
        confirmLabel="Request payout"
        busy={requesting}
        error={payoutError}
        onConfirm={() => void requestPayout()}
        onCancel={() => {
          setConfirmPayout(false);
          setPayoutError(null);
        }}
      >
        <p>
          Withdraws {claimable.partial ? "at least " : ""}
          {formatUsdc(claimable.usdc)} USDC from this event&apos;s escrow to your
          CrowdPass wallet.
        </p>
        <p>
          It&apos;s processed in the background. Track it in Payouts. While it&apos;s
          processing, you can&apos;t change your payout bank account.
        </p>
      </ConfirmDialog>
    </section>
  );
}
