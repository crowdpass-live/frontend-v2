"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { fetchPaymentMethods, purchaseTicket } from "@/lib/crowdpass";
import { money, normalizePhone } from "@/lib/format";
import { rememberPendingPurchase } from "@/lib/pending";
import { CardIcon, CoinIcon } from "@/components/icons";
import { Button, Card, ErrorNote, SectionTitle, Container, Spinner, cx } from "@/components/ui";
import type { ApiEvent, ApiTicketType, PaymentProvider } from "@/types/api";

/**
 * Guest checkout: no account, no password.
 *
 * The email is the identity — `POST /tickets/purchase` upserts a User row
 * from it so the mint worker has a wallet to mint into, and it is where the
 * ticket lands. Everything else on this form is either the order or the rail
 * it settles on.
 */
const schema = z.object({
  buyerName: z
    .string()
    .trim()
    .min(2, "Enter the name that should appear on the ticket")
    .max(120, "That name is too long"),
  buyerEmail: z
    .string()
    .trim()
    .min(1, "We need an email to send your ticket to")
    .email("That doesn't look like a valid email"),
  // Optional, but if given it must survive normalization — the backend DTO
  // rejects anything that isn't E.164 and fails the entire purchase on it.
  buyerPhone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || normalizePhone(v) !== null, {
      message: "Enter a valid Nigerian number, e.g. 0801 234 5678",
    }),
});

type FormValues = z.infer<typeof schema>;

/** How many of this tier one buyer may take, respecting both limits. */
function maxQuantityFor(tier: ApiTicketType | null): number {
  if (!tier) return 1;
  // The DTO caps quantity at 10 regardless of what the tier allows.
  const caps = [tier.available, tier.maxPerUser || Infinity, 10].filter(
    (n) => Number.isFinite(n) && n > 0,
  );
  return Math.max(1, Math.min(...caps));
}

function TierOption({
  tier,
  currency,
  selected,
  onSelect,
}: {
  tier: ApiTicketType;
  currency: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const disabled = !tier.isOnSale;
  return (
    <label
      className={cx(
        "flex cursor-pointer items-center gap-4 py-4",
        disabled && "cursor-not-allowed opacity-45",
      )}
    >
      <input
        type="radio"
        name="tier"
        className="sr-only"
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
      />
      <span
        aria-hidden
        className={cx(
          "grid size-8 shrink-0 place-items-center rounded-lg border-2 transition-colors",
          selected ? "border-accent" : "border-border-strong",
        )}
      >
        {selected ? <span className="size-3 rounded-full bg-accent" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold text-text">
          {tier.name}
        </span>
        <span className="block text-helper text-text-faint">
          {tier.available <= 0
            ? "Sold out"
            : `${tier.available} left${tier.maxPerUser ? ` · max ${tier.maxPerUser}/person` : ""}`}
        </span>
      </span>
      <span className="shrink-0 text-body font-bold text-text">
        {money(tier.price, currency)}
      </span>
    </label>
  );
}

function MethodOption({
  icon,
  title,
  subtitle,
  selected,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4 py-4">
      <input
        type="radio"
        name="method"
        className="sr-only"
        checked={selected}
        onChange={onSelect}
      />
      <span className="grid size-12 shrink-0 place-items-center rounded-control bg-surface text-text-dim">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold text-text">
          {title}
        </span>
        <span className="block text-helper text-text-faint">{subtitle}</span>
      </span>
      <span
        aria-hidden
        className={cx(
          "grid size-8 shrink-0 place-items-center rounded-lg border-2 transition-colors",
          selected ? "border-accent" : "border-border-strong",
        )}
      >
        {selected ? <span className="size-3 rounded-full bg-accent" /> : null}
      </span>
    </label>
  );
}

function Field({
  label,
  hint,
  error,
  ...props
}: React.ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-label text-text-dim">
        {label}
        {hint ? <span className="text-text-faint"> · {hint}</span> : null}
      </span>
      <input
        {...props}
        aria-invalid={!!error}
        className={cx(
          "h-14 rounded-control border bg-surface px-4 text-body text-text placeholder:text-text-faint",
          error ? "border-danger" : "border-border",
        )}
      />
      {error ? (
        <span role="alert" className="text-helper text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function CheckoutForm({ event }: { event: ApiEvent }) {
  const router = useRouter();
  const currency = event.currency || "NGN";
  const tiers = useMemo(() => event.ticketTypes ?? [], [event.ticketTypes]);

  const [tierId, setTierId] = useState<string | null>(
    () => tiers.find((t) => t.isOnSale)?.id ?? null,
  );
  const [requestedQuantity, setRequestedQuantity] = useState(1);
  const [chosenLane, setChosenLane] = useState<"fiat" | "crypto" | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const tier = tiers.find((t) => t.id === tierId) ?? null;
  const maxQuantity = maxQuantityFor(tier);

  // Which rails this organizer can actually take money on. Deliberately not
  // defaulted to PAYSTACK — the backend only lists a provider once the
  // organizer has a real subaccount, and offering one they haven't enabled
  // hands the buyer a button that always fails at gateway init.
  const methods = useQuery({
    queryKey: ["payment-methods", event.id],
    queryFn: () => fetchPaymentMethods(event.id),
  });

  // Both of the values below are DERIVED, not synced through an effect.
  //
  // The effect version had a window of one render where the state disagreed
  // with the props that determine it — a buyer who tapped Pay in that window
  // submitted the stale value. Deriving closes the window and drops two
  // effects.

  // Defaults to the only rail on offer until the buyer picks one.
  const lane =
    chosenLane ??
    (methods.data?.fiat ? "fiat" : methods.data?.crypto ? "crypto" : null);

  // A buyer who picked 4 of a tier with 40 left and then switched to one with
  // 2 left must not carry the 4 across.
  const quantity = Math.min(Math.max(1, requestedQuantity), maxQuantity);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { buyerName: "", buyerEmail: "", buyerPhone: "" },
  });

  const unitPrice = Number(tier?.price ?? 0);
  const total = unitPrice * quantity;

  const purchase = useMutation({
    mutationFn: purchaseTicket,
    onSuccess: (result) => {
      // Remember the reference before navigating away. The gateway redirect
      // comes back with a reference in the query string, but a buyer who
      // closes the tab mid-payment and reopens the site has nothing else to
      // reconnect them to their pending order.
      rememberPendingPurchase({
        reference: result.reference,
        eventSlug: event.slug,
        eventName: event.name,
        amount: result.amount,
        currency: result.currency,
        ticketReference: result.tickets?.[0]?.reference ?? null,
      });

      const first = result.tickets?.[0]?.reference;

      // Free events settle in the same write — no gateway round trip.
      if (result.free && first) {
        router.push(`/tickets/${first}`);
        return;
      }

      if (result.checkoutUrl) {
        // The one navigation that is NOT router.push: the gateway is a
        // different origin and must own the tab, so its 3-D Secure step and
        // its redirect back to us both work.
        window.location.assign(result.checkoutUrl);
        return;
      }

      // Crypto lane, or a fiat init that returned no URL. The callback page
      // polls settlement and knows how to render every terminal state.
      router.push(
        `/checkout/callback?reference=${encodeURIComponent(result.reference)}`,
      );
    },
    onError: (err) => {
      // A timeout says nothing about whether the purchase happened — the call
      // waits on Paystack, so the transaction may exist. Send the buyer to
      // the callback page to find out rather than inviting a second attempt
      // that would take a second seat.
      if (err instanceof ApiError && err.status === 0) {
        setSubmitError(
          "We lost the connection while setting up your payment. Checking whether it went through…",
        );
        window.setTimeout(() => router.push("/checkout/callback"), 1200);
        return;
      }
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Something went wrong setting up your payment. Please try again.",
      );
    },
  });

  const provider: PaymentProvider | null =
    lane === "crypto"
      ? "CRYPTO"
      : lane === "fiat"
        ? (methods.data?.fiat?.provider ?? null)
        : null;

  const onSubmit = form.handleSubmit((values) => {
    setSubmitError(null);
    if (!tier || !provider) {
      setSubmitError("Pick a ticket and a payment method to continue.");
      return;
    }

    const phone = normalizePhone(values.buyerPhone);

    purchase.mutate({
      eventId: event.id,
      ticketTypeId: tier.id,
      quantity,
      buyerEmail: values.buyerEmail.trim(),
      buyerName: values.buyerName.trim(),
      // Omitted entirely when absent — sending null fails the DTO's
      // `forbidNonWhitelisted`-adjacent validation on a malformed string.
      ...(phone ? { buyerPhone: phone } : null),
      deliveryChannel: "EMAIL",
      paymentProvider: provider,
      // Honoured only if this origin is on the backend's allowlist
      // (CORS_ORIGINS / APP_URL); otherwise the backend keeps its own
      // callback page and the buyer still settles, just on the API's page.
      returnUrl: `${window.location.origin}/checkout/callback`,
    });
  });

  const busy = purchase.isPending;
  const noRails =
    methods.isSuccess && !methods.data.fiat && !methods.data.crypto;

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-12"
    >
      <div className="flex flex-col gap-8">
      {/* Ticket */}
      <section className="flex flex-col gap-1">
        <SectionTitle>Select ticket</SectionTitle>
        <div className="divide-y divide-border">
          {tiers.map((t) => (
            <TierOption
              key={t.id}
              tier={t}
              currency={currency}
              selected={t.id === tierId}
              onSelect={() => setTierId(t.id)}
            />
          ))}
        </div>
      </section>

      {/* Quantity */}
      <section className="flex items-center justify-between gap-4 border-t border-border pt-6">
        <div>
          <p className="text-body text-text-dim">Quantity</p>
          {tier && maxQuantity < 10 ? (
            <p className="text-helper text-text-faint">
              Up to {maxQuantity} on this ticket
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Decrease quantity"
            disabled={quantity <= 1}
            onClick={() => setRequestedQuantity(Math.max(1, quantity - 1))}
            className="grid size-11 place-items-center rounded-full border border-border-strong text-text transition-colors hover:bg-surface disabled:opacity-35"
          >
            <span aria-hidden className="text-xl leading-none">−</span>
          </button>
          <span
            aria-live="polite"
            className="min-w-8 text-center text-title font-bold text-text"
          >
            {quantity}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            disabled={quantity >= maxQuantity}
            onClick={() => setRequestedQuantity(Math.min(maxQuantity, quantity + 1))}
            className="grid size-11 place-items-center rounded-full bg-accent text-ink transition-colors hover:bg-accent-hi disabled:opacity-35 disabled:hover:bg-accent"
          >
            <span aria-hidden className="text-xl leading-none">+</span>
          </button>
        </div>
      </section>

      {/* Buyer — the piece the mobile design has no equivalent for, because
       * mobile always has a session to read name and email from. */}
      <section className="flex flex-col gap-4 border-t border-border pt-6">
        <div>
          <SectionTitle>Your details</SectionTitle>
          <p className="mt-1 text-helper text-text-faint">
            No account needed. Your ticket is emailed to you.
          </p>
        </div>
        <Field
          label="Full name"
          autoComplete="name"
          placeholder="Ada Okeke"
          error={form.formState.errors.buyerName?.message}
          {...form.register("buyerName")}
        />
        <Field
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="ada@example.com"
          error={form.formState.errors.buyerEmail?.message}
          {...form.register("buyerEmail")}
        />
        <Field
          label="Phone"
          hint="optional"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0801 234 5678"
          error={form.formState.errors.buyerPhone?.message}
          {...form.register("buyerPhone")}
        />
      </section>

      {/* Payment */}
      <section className="flex flex-col gap-1 border-t border-border pt-6">
        <SectionTitle>Payment</SectionTitle>
        {methods.isPending ? (
          <p className="py-4 text-body text-text-faint">
            <Spinner className="mr-2 align-[-2px]" />
            Loading payment options…
          </p>
        ) : noRails ? (
          <Card className="mt-3 p-4 text-body text-text-dim">
            This organizer hasn&apos;t finished setting up payments yet, so
            tickets can&apos;t be sold right now.
          </Card>
        ) : methods.isError ? (
          <div className="mt-3 flex flex-col gap-3">
            <ErrorNote>Could not load payment options.</ErrorNote>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => methods.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {methods.data?.fiat ? (
              <MethodOption
                icon={<CardIcon />}
                title="Pay with card or transfer"
                subtitle={
                  methods.data.fiat.methods.length
                    ? methods.data.fiat.methods
                        .map((m) => FIAT_LABELS[m] ?? m)
                        .join(" · ")
                    : "Card · Transfer · USSD"
                }
                selected={lane === "fiat"}
                onSelect={() => setChosenLane("fiat")}
              />
            ) : null}
            {methods.data?.crypto ? (
              <MethodOption
                icon={<CoinIcon />}
                title="Pay with crypto"
                subtitle={
                  methods.data.crypto.tokens.length
                    ? methods.data.crypto.tokens.join(" · ")
                    : "USDC"
                }
                selected={lane === "crypto"}
                onSelect={() => setChosenLane("crypto")}
              />
            ) : null}
          </div>
        )}
      </section>

      {submitError ? <ErrorNote>{submitError}</ErrorNote> : null}
      </div>

      {/* Order summary + pay.
       *
       * ONE element in two positions, not two elements: a fixed bottom bar on
       * a phone, a sticky sidebar card from `lg`. Rendering it twice would put
       * two submit buttons in one form, and the browser would treat the first
       * as the implicit submit on Enter — so the visible button and the one
       * that actually fires could differ by breakpoint.
       *
       * No fee row: the buyer pays the advertised price and nothing more — the
       * 5% platform fee is organizer-side and deducted at settlement. This
       * resolves open issue #2 in the design doc the same way the mobile app
       * resolved it. */}
      <aside className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur lg:sticky lg:top-24 lg:z-auto lg:rounded-card lg:border lg:bg-surface lg:backdrop-blur-none">
        <Container className="flex flex-col gap-3 py-4 lg:max-w-none lg:gap-5 lg:px-6 lg:py-6">
          <p className="hidden text-section font-bold text-text lg:block">
            Order summary
          </p>

          <div className="flex items-baseline justify-between gap-4">
            <span className="truncate text-label text-text-faint">
              {tier ? `${quantity} × ${tier.name}` : "No ticket selected"}
            </span>
            <span className="shrink-0 text-body font-bold text-text">
              {money(total, currency)}
            </span>
          </div>

          {/* Only on the sidebar — the mobile bar has no room, and the total
           * is already the line above it. */}
          <div className="hidden border-t border-border pt-4 lg:flex lg:items-baseline lg:justify-between lg:gap-4">
            <span className="text-body text-text-dim">Total</span>
            <span className="text-title font-bold text-text">
              {money(total, currency)}
            </span>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!tier || !provider || busy}
          >
            {busy ? (
              <>
                <Spinner />
                Setting up payment…
              </>
            ) : total === 0 ? (
              "Get ticket"
            ) : (
              `Pay ${money(total, currency)}`
            )}
          </Button>

          <p className="hidden text-center text-helper text-text-faint lg:block">
            You&apos;ll be redirected to a secure checkout.
          </p>
        </Container>
      </aside>
    </form>
  );
}

const FIAT_LABELS: Record<string, string> = {
  CARD: "Card",
  BANK_TRANSFER: "Transfer",
  USSD: "USSD",
  APPLE_PAY: "Apple Pay",
};
