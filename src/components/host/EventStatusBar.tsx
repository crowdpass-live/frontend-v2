"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { BusyOverlay } from "@/components/BusyOverlay";
import { Celebration } from "@/components/Celebration";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CheckIcon } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui";
import type { EventStatus } from "@/types/api";

/** What the event will be able to sell through, decided at publish time. */
export type PaymentLanes = "fiat-and-crypto" | "crypto-only";

/**
 * The strip above an event's tabs: for a DRAFT, what a draft is plus Edit
 * and Publish (#39); right after publishing, "you're live" with the link.
 *
 * Publish is `POST /events/:id/publish`, which flips the event to PUBLISHED
 * and queues one on-chain registration per ticket type — slow, so a long
 * timeout and a `BusyOverlay` naming the steps. The backend refuses only
 * when the event takes neither crypto nor fiat; every event takes USDC by
 * default (`acceptsCrypto`, not settable from the form), so the real
 * question for the host is whether CARD AND TRANSFER work too — and the
 * confirmation says so plainly, with the way to fix it.
 *
 * Kept mounted across the refresh that turns DRAFT into PUBLISHED, which is
 * how the "you're live" card survives it.
 */
export function EventStatusBar({
  eventId,
  eventName,
  status,
  lanes,
}: {
  eventId: string;
  eventName: string;
  status: EventStatus;
  lanes: PaymentLanes;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [confirming, setConfirming] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<{ slug: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function publish() {
    setConfirming(false);
    setPublishing(true);
    setError(null);
    try {
      const res = await apiFetch<{ slug: string }>(`/events/${encodeURIComponent(eventId)}/publish`, {
        method: "POST",
        auth: true,
        // On-chain registration is queued, but the call still does real work.
        timeout: 60_000,
      });
      setLive({ slug: res.slug });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't publish. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  if (live) {
    const url = `${typeof window === "undefined" ? "" : window.location.origin}/events/${live.slug}`;
    return (
      <section aria-label="Published" className="relative flex flex-col gap-4 overflow-hidden rounded-card border border-ok/30 bg-ok/10 p-5">
        <Celebration seed={11} />
        <div className="flex items-start gap-3">
          <CheckIcon className="mt-0.5 shrink-0 text-ok" />
          <div className="min-w-0">
            <p className="text-body font-bold text-text">{eventName} is live.</p>
            <p className="text-label text-text-dim">
              Tickets are on sale now. On-chain ticket registration finishes in
              the background over the next few minutes — you don&apos;t need to wait.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <ButtonLink href={`/events/${live.slug}`} size="sm" className="w-full sm:w-auto">
            View the event page
          </ButtonLink>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => {
              void navigator.clipboard?.writeText(url).then(() => setCopied(true));
            }}
          >
            {copied ? "Link copied" : "Copy link to share"}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="w-full sm:w-auto" onClick={() => setLive(null)}>
            Done
          </Button>
        </div>
      </section>
    );
  }

  if (status !== "DRAFT" || pathname.endsWith("/edit")) return null;

  return (
    <section
      aria-label="Draft"
      className="flex flex-col gap-3 rounded-card border border-accent/30 bg-accent-tint p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-body font-bold text-text">This is a draft — only you can see it.</p>
          <p className="text-label text-text-dim">Check the details, then publish to start selling.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <ButtonLink href={`/host/events/${eventId}/edit`} variant="secondary" size="sm" className="w-full sm:w-auto">
            Edit draft
          </ButtonLink>
          <Button type="button" size="sm" disabled={publishing} onClick={() => setConfirming(true)} className="w-full sm:w-auto">
            Publish
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-label text-danger">
          {error}
        </p>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={`Publish ${eventName}?`}
        confirmLabel="Publish now"
        cancelLabel="Not yet"
        onConfirm={() => void publish()}
        onCancel={() => setConfirming(false)}
      >
        <span className="flex flex-col gap-3">
          <span>
            It goes live on CrowdPass and tickets go on sale straight away. After
            this, only ticket prices can change.
          </span>
          {lanes === "crypto-only" ? (
            <span className="rounded-control border border-warn/40 bg-warn/10 px-3 py-2 text-warn">
              Buyers can only pay in USDC for now — you haven&apos;t connected a bank,
              so card and bank transfer are off.{" "}
              <Link href="/host/payout-account" className="font-bold underline underline-offset-2">
                Connect a bank
              </Link>{" "}
              first, or publish now and add it later.
            </span>
          ) : (
            <span>Buyers can pay by card, bank transfer or USDC.</span>
          )}
        </span>
      </ConfirmDialog>

      <BusyOverlay
        open={publishing}
        title="Publishing your event"
        steps={["Taking it live on CrowdPass", "Queueing on-chain ticket registration"]}
        current={0}
      />
    </section>
  );
}
