"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { claimTicket, verifyClaim } from "@/lib/crowdpass";
import { normalizePhone } from "@/lib/format";
import { Button, ErrorNote, Field, Spinner, cx } from "@/components/ui";
import { CheckIcon, CloseIcon } from "@/components/icons";
import type { ApiTicketType } from "@/types/api";

/**
 * `POST /tickets/claim` redeems a matNo the organizer pre-imported, checked
 * against the full name on file. Two steps, not one form: step 1 (name +
 * matNo) is verified against `POST /tickets/claim/verify` before step 2
 * (email + phone) even shows, so a buyer who mistypes their matric number
 * finds out before they've also typed their email — and never types contact
 * details for a claim list they aren't actually on.
 */
const schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the name on the claim list")
    .max(200, "That name is too long"),
  matNo: z
    .string()
    .trim()
    .min(1, "Enter your matric number")
    .max(50, "That matric number is too long"),
  buyerEmail: z
    .string()
    .trim()
    .min(1, "We need an email to send your ticket to")
    .email("That doesn't look like a valid email"),
  buyerPhone: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || normalizePhone(v) !== null, {
      message: "Enter a valid Nigerian number, e.g. 0801 234 5678",
    }),
});

type FormValues = z.infer<typeof schema>;
type Step = "identify" | "contact";

export function ClaimTicketButton({
  eventId,
  tier,
}: {
  eventId: string;
  tier: ApiTicketType;
}) {
  const [open, setOpen] = useState(false);
  const disabled = !tier.isOnSale;

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="h-10 shrink-0 px-4 text-label"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {tier.available <= 0
          ? "Sold out"
          : !tier.isOnSale
            ? "Not on sale"
            : "Claim your ticket"}
      </Button>
      {open ? (
        <ClaimDialog eventId={eventId} tier={tier} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function ClaimDialog({
  eventId,
  tier,
  onClose,
}: {
  eventId: string;
  tier: ApiTicketType;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("identify");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { fullName: "", matNo: "", buyerEmail: "", buyerPhone: "" },
  });

  // Escape closes the dialog, same as the backdrop and the X button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const verify = useMutation({
    mutationFn: verifyClaim,
    onSuccess: () => setStep("contact"),
    onError: (err) => {
      // Same no-auto-retry reasoning as claim() below: a wrong name here
      // counts toward the entry's 3-strike lockout exactly like a wrong
      // name in the real claim would, and shares the same 8/min throttle.
      setVerifyError(
        err instanceof Error
          ? err.message
          : "Something went wrong checking those details. Please try again.",
      );
    },
  });

  const claim = useMutation({
    mutationFn: claimTicket,
    onSuccess: (result) => {
      router.push(`/tickets/${result.ticket.reference}?celebrate=1`);
    },
    onError: (err) => {
      // The backend's message is already what the buyer should see — "This
      // matric number has already claimed a ticket", "No tickets remaining
      // for this type", etc. Never auto-retry: the endpoint's own per-IP
      // throttle (8/min) is tight enough that a retry loop can burn the
      // buyer's whole budget for the minute.
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Something went wrong submitting your claim. Please try again.",
      );
    },
  });

  const onContinue = async () => {
    setVerifyError(null);
    const ok = await form.trigger(["fullName", "matNo"]);
    if (!ok) return;
    const { fullName, matNo } = form.getValues();
    verify.mutate({
      eventId,
      ticketTypeId: tier.id,
      fullName: fullName.trim(),
      matNo: matNo.trim(),
    });
  };

  const onBack = () => {
    setStep("identify");
    setSubmitError(null);
  };

  const onSubmit = form.handleSubmit((values) => {
    setSubmitError(null);
    const phone = normalizePhone(values.buyerPhone);
    claim.mutate({
      eventId,
      ticketTypeId: tier.id,
      fullName: values.fullName.trim(),
      matNo: values.matNo.trim(),
      buyerEmail: values.buyerEmail.trim(),
      ...(phone ? { buyerPhone: phone } : null),
      deliveryChannel: "EMAIL",
    });
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="claim-dialog-title"
      className="fixed inset-0 z-30 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full flex-col gap-6 overflow-y-auto rounded-t-card border-t border-border bg-bg p-6 sm:max-w-[440px] sm:rounded-card sm:border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="claim-dialog-title" className="text-section font-bold text-text">
              Claim your ticket
            </h2>
            <p className="mt-1 text-helper text-text-faint">
              {tier.name} · Step {step === "identify" ? "1" : "2"} of 2
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full text-text-dim transition-colors hover:bg-surface hover:text-text"
          >
            <CloseIcon />
          </button>
        </div>

        {step === "identify" ? (
          // Step 1 — matNo + full name checked against the imported claim
          // list (POST /tickets/claim/verify) before contact details are
          // even asked for. Its own <form> (separate from step 2's) so
          // Enter runs the verify check here, never the real claim.
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onContinue();
            }}
            className="flex flex-col gap-4"
          >
            <Field
              label="Full name"
              hint="as it appears on the claim list"
              autoComplete="name"
              placeholder="Chinedu Okafor"
              error={form.formState.errors.fullName?.message}
              {...form.register("fullName")}
            />
            <Field
              label="Matric number"
              placeholder="CSC/2021/041"
              error={form.formState.errors.matNo?.message}
              {...form.register("matNo")}
            />

            {verifyError ? <ErrorNote>{verifyError}</ErrorNote> : null}

            <Button
              type="submit"
              className={cx("w-full", verify.isPending && "opacity-70")}
              disabled={verify.isPending}
            >
              {verify.isPending ? (
                <>
                  <Spinner />
                  Checking…
                </>
              ) : (
                "Continue"
              )}
            </Button>
          </form>
        ) : (
          // Step 2 — name + matNo are locked in as whatever passed
          // verification; editing them means going back and re-verifying,
          // never silently swapping in an unverified pair at submit time.
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3 rounded-control border border-ok/30 bg-ok/10 px-4 py-3">
              <div className="flex items-start gap-3">
                <CheckIcon width={18} height={18} className="mt-0.5 shrink-0 text-ok" />
                <div className="min-w-0">
                  <p className="truncate text-label font-semibold text-text">
                    {form.getValues("fullName")}
                  </p>
                  <p className="truncate text-helper text-text-faint">
                    {form.getValues("matNo")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onBack}
                className="shrink-0 text-helper font-medium text-accent-deep hover:underline"
              >
                Change
              </button>
            </div>

            <Field
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="chinedu@example.com"
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

            {submitError ? <ErrorNote>{submitError}</ErrorNote> : null}

            <Button
              type="submit"
              className={cx("w-full", claim.isPending && "opacity-70")}
              disabled={claim.isPending}
            >
              {claim.isPending ? (
                <>
                  <Spinner />
                  Claiming…
                </>
              ) : (
                "Claim ticket"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
