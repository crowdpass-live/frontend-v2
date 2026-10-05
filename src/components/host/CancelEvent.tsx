"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui";
import type { EventStatus } from "@/types/api";

/**
 * Delete a draft, or cancel a live event (#39) — `DELETE /events/:id`, a soft
 * cancel to CANCELLED. There is no un-cancel, so the confirmation says
 * exactly what happens, and to whom:
 *
 * - a draft: it's discarded (its ticket types are deleted);
 * - live, nothing sold: it comes off sale;
 * - live, sold, refundable: USDC tickets are refunded on-chain automatically;
 *   card and transfer tickets are NOT refunded by this — the backend logs
 *   them for off-chain handling — so the host is told to expect that;
 * - live, sold, NOT refundable: the backend refuses, so there is no button,
 *   only the reason and where to go.
 */
export function CancelEvent({
  eventId,
  eventName,
  status,
  ticketsSold,
  isRefundable,
}: {
  eventId: string;
  eventName: string;
  status: EventStatus;
  ticketsSold: number;
  isRefundable: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "DRAFT" && status !== "PUBLISHED") return null;
  const draft = status === "DRAFT";
  const blocked = !draft && ticketsSold > 0 && !isRefundable;
  const sold = `${ticketsSold.toLocaleString("en-NG")} ticket${ticketsSold === 1 ? "" : "s"}`;

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/events/${encodeURIComponent(eventId)}`, { method: "DELETE", auth: true, timeout: 45_000 });
      setOpen(false);
      toast(draft ? "Draft deleted." : `${eventName} is cancelled.`, { tone: "ok" });
      if (draft) router.push("/host");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't cancel. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="danger" className="flex flex-col gap-3 rounded-card border border-danger/30 p-5">
      <h2 id="danger" className="text-section font-bold text-text">
        {draft ? "Delete this draft" : "Cancel this event"}
      </h2>
      {blocked ? (
        <p className="text-label text-text-dim">
          {sold} sold and the event isn&apos;t refundable, so it can&apos;t be
          cancelled here — buyers would be left with nothing. Contact CrowdPass
          support to sort it out.
        </p>
      ) : (
        <>
          <p className="text-label text-text-dim">
            {draft
              ? "It's discarded with its ticket types. Nobody has seen it."
              : ticketsSold > 0
                ? `It comes off sale for good. ${sold} sold — see what happens to them before you confirm.`
                : "It comes off sale for good. Nothing has sold yet."}
          </p>
          <Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)} className="w-full sm:w-fit">
            {draft ? "Delete draft" : "Cancel event"}
          </Button>
        </>
      )}

      {blocked ? null : (
        <ConfirmDialog
          open={open}
          tone="danger"
          title={draft ? "Delete this draft?" : `Cancel ${eventName}?`}
          confirmLabel={draft ? "Delete draft" : "Cancel event"}
          cancelLabel={draft ? "Keep draft" : "Keep event"}
          busy={busy}
          error={error}
          onConfirm={() => void cancel()}
          onCancel={() => {
            setOpen(false);
            setError(null);
          }}
        >
          {draft ? (
            "The draft and its ticket types are deleted. This can't be undone."
          ) : ticketsSold > 0 ? (
            <span className="flex flex-col gap-2">
              <span>
                {sold} sold. Tickets bought with USDC are refunded on-chain
                automatically. Tickets paid by card or bank transfer are not
                refunded by this — CrowdPass support handles those, so expect to
                hear from buyers.
              </span>
              <span className="font-bold text-text">There&apos;s no undo.</span>
            </span>
          ) : (
            "It comes off sale immediately and can't be published again. There's no undo."
          )}
        </ConfirmDialog>
      )}
    </section>
  );
}
