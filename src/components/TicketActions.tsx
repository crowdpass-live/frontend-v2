"use client";

import { useState } from "react";
import { Button, Spinner, cx } from "./ui";
import {
  renderTicketImage,
  ticketFileName,
  type TicketImageInput,
} from "@/lib/ticket-image";

function DownloadIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v12M7 11l5 5 5-5M4 21h16" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.25-8.23a8.23 8.23 0 0 1 0 16.45Z" />
    </svg>
  );
}

type Status = "idle" | "working" | "done" | "error";

/**
 * Save the ticket as an image, and hand it to WhatsApp.
 *
 * Both actions share one rendered PNG, produced by `renderTicketImage`. The
 * sharing story differs per platform and there is no single API that covers
 * it, so this degrades in three steps:
 *
 *   1. `navigator.share` **with the file** — the good path on iOS and Android.
 *      The buyer picks WhatsApp from the system sheet and the image goes into
 *      the chat.
 *   2. `navigator.share` with a link — some browsers expose sharing but refuse
 *      files (`canShare({files})` is false).
 *   3. A `wa.me` link with the ticket URL — desktop, and anything else. This
 *      cannot carry the image: WhatsApp's URL scheme takes text only, so the
 *      buyer gets a link to this page rather than a picture. Downloading and
 *      attaching is the workaround, which is why Download is a peer action
 *      rather than hidden in a menu.
 */
export function TicketActions({
  ticket,
  shareUrl,
}: {
  ticket: TicketImageInput;
  shareUrl: string;
}) {
  const [download, setDownload] = useState<Status>("idle");
  const [share, setShare] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const shareText = `My ticket for ${ticket.eventName} — ${shareUrl}`;

  const onDownload = async () => {
    setError(null);
    setDownload("working");
    try {
      const blob = await renderTicketImage(ticket);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = ticketFileName(ticket.eventName, ticket.reference);
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoked on a delay: Safari aborts the save if the object URL is
      // released in the same tick as the click.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDownload("done");
      setTimeout(() => setDownload("idle"), 2500);
    } catch (err) {
      setDownload("error");
      setError(
        err instanceof Error
          ? `Could not save the image: ${err.message}`
          : "Could not save the image.",
      );
    }
  };

  const onShare = async () => {
    setError(null);
    setShare("working");
    try {
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };

      if (typeof nav.share === "function") {
        const blob = await renderTicketImage(ticket);
        const file = new File(
          [blob],
          ticketFileName(ticket.eventName, ticket.reference),
          { type: "image/png" },
        );

        if (nav.canShare?.({ files: [file] })) {
          await nav.share({
            files: [file],
            title: ticket.eventName,
            text: `My ticket for ${ticket.eventName}`,
          });
          setShare("idle");
          return;
        }

        await nav.share({
          title: ticket.eventName,
          text: `My ticket for ${ticket.eventName}`,
          url: shareUrl,
        });
        setShare("idle");
        return;
      }

      // No Web Share at all — desktop. Straight to WhatsApp with a link.
      window.open(
        `https://wa.me/?text=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer",
      );
      setShare("idle");
    } catch (err) {
      // The buyer dismissing the system share sheet throws AbortError. That is
      // a normal outcome, not a failure worth shouting about.
      if (err instanceof Error && err.name === "AbortError") {
        setShare("idle");
        return;
      }
      setShare("error");
      setError("Could not open the share sheet. Try downloading instead.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={onDownload}
          disabled={download === "working"}
        >
          {download === "working" ? (
            <Spinner />
          ) : (
            <DownloadIcon />
          )}
          {download === "done" ? "Saved" : "Download"}
        </Button>

        <Button
          type="button"
          className="w-full"
          onClick={onShare}
          disabled={share === "working"}
        >
          {share === "working" ? <Spinner /> : <WhatsAppIcon />}
          Share
        </Button>
      </div>

      <p
        className={cx(
          "text-center text-helper",
          error ? "text-danger" : "text-text-faint",
        )}
        role={error ? "alert" : undefined}
      >
        {error ?? "Saves as a picture you can send to anyone."}
      </p>
    </div>
  );
}
