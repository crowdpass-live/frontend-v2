"use client";

import { useEffect, useState } from "react";
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

type NavigatorWithShare = Navigator & {
  canShare?: (data: ShareData) => boolean;
};

/**
 * Save the ticket as an image, and hand it to WhatsApp.
 *
 * ## Why the image is rendered before anyone taps
 *
 * `navigator.share()` requires **transient user activation**, and on iOS
 * Safari an `await` between the tap and the call consumes it — the share sheet
 * never opens and you get `NotAllowedError` instead. Rendering the card inside
 * the click handler (the obvious way to write this) therefore fails on iPhone,
 * which is a large share of the audience for a Nigerian event product.
 *
 * So the PNG is rendered once on mount, during idle time, and both buttons
 * stay disabled until it exists. By the time anyone has read the page and
 * reached for a button it is ready, and the handlers below call `share()` and
 * `click()` **synchronously** — no `await` before either.
 *
 * ## What actually happens per platform
 *
 * - **Phone with file sharing** (iOS 15+, Android Chrome): the system sheet
 *   opens with the PNG attached. WhatsApp is one tap away, and so is
 *   "Save Image" — which is the real way to get a picture into an iPhone's
 *   photo library, since `<a download>` there is inconsistent.
 * - **Browser that shares links but not files:** the sheet opens with a link
 *   to this page.
 * - **Desktop:** a `wa.me` link. It carries text only — WhatsApp's URL scheme
 *   cannot attach an image — so the buyer gets a link, and Download is the way
 *   to get the picture itself. That is why Download is a peer button and not
 *   hidden in a menu.
 */
export function TicketActions({
  ticket,
  shareUrl,
}: {
  ticket: TicketImageInput;
  shareUrl: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [renderFailed, setRenderFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Render once, off the critical path. `requestIdleCallback` keeps a low-end
  // Android from spending its first frames on a canvas the buyer is not
  // looking at yet; the timeout stops it being deferred forever.
  useEffect(() => {
    let alive = true;
    const run = () => {
      renderTicketImage(ticket)
        .then((blob) => {
          if (!alive) return;
          setFile(
            new File([blob], ticketFileName(ticket.eventName, ticket.reference), {
              type: "image/png",
            }),
          );
        })
        .catch(() => alive && setRenderFailed(true));
    };

    const ric = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    const id = ric ? ric(run, { timeout: 1500 }) : window.setTimeout(run, 200);
    return () => {
      alive = false;
      const cic = (
        window as unknown as { cancelIdleCallback?: (h: number) => void }
      ).cancelIdleCallback;
      if (ric && cic) cic(id);
      else window.clearTimeout(id);
    };
  }, [ticket]);

  const shareText = `My ticket for ${ticket.eventName} — ${shareUrl}`;

  /** Synchronous by design — see the note above. */
  const onDownload = () => {
    if (!file) return;
    setError(null);
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    // Safari on iOS ignores a detached anchor.
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoked late: Safari aborts the save if the object URL is released in
    // the same tick as the click.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  /** Also synchronous: `share()` is reached with user activation intact. */
  const onShare = () => {
    setError(null);
    const nav = navigator as NavigatorWithShare;

    const onShareError = (err: unknown) => {
      // Dismissing the sheet throws AbortError. That is a normal outcome.
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Couldn't open the share sheet — try Download instead.");
    };

    if (file && typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
      nav
        .share({
          files: [file],
          title: ticket.eventName,
          text: `My ticket for ${ticket.eventName}`,
        })
        .catch(onShareError);
      return;
    }

    if (typeof nav.share === "function") {
      nav
        .share({
          title: ticket.eventName,
          text: `My ticket for ${ticket.eventName}`,
          url: shareUrl,
        })
        .catch(onShareError);
      return;
    }

    window.open(
      `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  // With no image, sharing a link still works; downloading does not.
  const preparing = !file && !renderFailed;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={onDownload}
          disabled={!file}
          aria-busy={preparing}
        >
          {preparing ? <Spinner /> : <DownloadIcon />}
          {saved ? "Saved" : "Download"}
        </Button>

        <Button
          type="button"
          className="w-full"
          onClick={onShare}
          disabled={preparing}
          aria-busy={preparing}
        >
          {preparing ? <Spinner /> : <WhatsAppIcon />}
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
        {error ??
          (renderFailed
            ? "Couldn't build the ticket image. Share still sends a link, and your reference works at the door."
            : "Share sends the ticket as a picture — or use it to save it to your photos.")}
      </p>
    </div>
  );
}
