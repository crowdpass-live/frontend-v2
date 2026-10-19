"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { money } from "@/lib/format";
import { organizerVendorsPath } from "@/lib/vendors";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import type { ApiVendorApplication } from "@/types/api";

/** `RejectVendorApplicationDto` / `CancelVendorApplicationDto`. */
const REASON_MAX = 500;

type Action = "approve" | "reject" | "cancel";

/**
 * Approve, reject or cancel one application (#44). Only a pending one can
 * be approved or rejected; only an approved one cancelled. Rejected and
 * cancelled are final, so both ask first and say so.
 *
 * Every transition is guarded server-side: a 409 means someone (another
 * organizer, or the vendor withdrawing) acted first. The row is reloaded
 * either way, so what's on screen is what's true.
 */
export function VendorReviewActions({
  eventId,
  application: a,
}: {
  eventId: string;
  application: ApiVendorApplication;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fee = a.stallType.price;
  const paid = a.paymentStatus === "PAID";
  // A free stall is PAID with nothing to give back.
  const paidMoney = paid && (a.priceAtApproval ?? 0) > 0;

  function start(action: Action) {
    setOpen(action);
    setReason("");
    setError(null);
  }

  async function run() {
    if (!open) return;
    const trimmed = reason.trim();
    if (open === "reject" && !trimmed) {
      setError("Say why — the vendor sees this in their email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch<ApiVendorApplication>(
        organizerVendorsPath(eventId, `/vendors/${encodeURIComponent(a.id)}/${open}`),
        {
          method: "POST",
          auth: true,
          // Approve takes no body; cancel's reason is optional and omitted when empty.
          body: open === "approve" ? undefined : trimmed ? { reason: trimmed } : {},
        },
      );
      const done = {
        approve:
          fee > 0
            ? `${a.businessName} approved — they've been emailed to pay.`
            : `${a.businessName} approved — their door passes are issued.`,
        reject: `${a.businessName} rejected.`,
        cancel: `${a.businessName}'s stall cancelled.`,
      }[open];
      setOpen(null);
      toast(done);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Stale row or a full stall: show why, and reload what's true.
        router.refresh();
      }
      setError(
        err instanceof ApiError
          ? err.status === 0
            ? "No connection. Nothing was changed — try again when you have signal."
            : err.message
          : "That didn't go through. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (a.status !== "PENDING" && a.status !== "APPROVED") return null;

  return (
    <>
      <div className="-ml-3 flex flex-wrap items-center gap-1">
        {a.status === "PENDING" ? (
          <>
            <button
              type="button"
              onClick={() => start("approve")}
              className="h-10 rounded-full px-3 text-label font-bold text-accent hover:bg-accent-tint"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => start("reject")}
              className="h-10 rounded-full px-3 text-label text-text-dim hover:bg-danger/10 hover:text-danger"
            >
              Reject
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => start("cancel")}
            className="h-10 rounded-full px-3 text-label text-text-dim hover:bg-danger/10 hover:text-danger"
          >
            Cancel stall
          </button>
        )}
      </div>

      <ConfirmDialog
        open={open === "approve"}
        title={`Approve ${a.businessName}?`}
        confirmLabel="Approve"
        busy={busy}
        error={error}
        onConfirm={() => void run()}
        onCancel={() => setOpen(null)}
      >
        <p>
          This holds one <span className="text-text">{a.stallType.name}</span> stall for them.
        </p>
        <p>
          {fee > 0
            ? `They're emailed to pay ${money(fee)} within 7 days; their door passes arrive once they pay.`
            : "It's a free stall, so they're confirmed straight away and get their door passes by email."}
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={open === "reject"}
        title={`Reject ${a.businessName}?`}
        confirmLabel="Reject"
        tone="danger"
        busy={busy}
        error={error}
        onConfirm={() => void run()}
        onCancel={() => setOpen(null)}
      >
        <p>This is final, and they haven&apos;t been charged. They&apos;re emailed your reason.</p>
        <ReasonField
          id={`reject-${a.id}`}
          label="Reason"
          value={reason}
          onChange={setReason}
          placeholder="e.g. We already have enough grill vendors"
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={open === "cancel"}
        title={`Cancel ${a.businessName}'s stall?`}
        confirmLabel="Cancel stall"
        cancelLabel="Keep it"
        tone="danger"
        busy={busy}
        error={error}
        onConfirm={() => void run()}
        onCancel={() => setOpen(null)}
      >
        <p>
          This is final. The stall is freed for someone else, their door passes stop
          working and their ticket link is switched off.
        </p>
        {paidMoney ? (
          <p className="rounded-control border border-warn/40 bg-warn/10 px-3 py-2 text-label text-warn">
            They&apos;ve paid {money(a.priceAtApproval)}. The CrowdPass team refunds it by
            hand — there&apos;s nothing for you to do, but it isn&apos;t instant.
          </p>
        ) : null}
        <ReasonField
          id={`cancel-${a.id}`}
          label="Reason (optional)"
          value={reason}
          onChange={setReason}
          placeholder="Shown to the vendor"
        />
      </ConfirmDialog>
    </>
  );
}

function ReasonField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <span className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label text-text-dim">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={REASON_MAX}
        placeholder={placeholder}
        className="resize-y rounded-control border border-border bg-bg px-4 py-3 text-body text-text placeholder:text-text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </span>
  );
}
