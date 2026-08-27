"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Renders the ticket QR from its signed token.
 *
 * `ticket.qrCode` is NOT an image: the backend stores the compact signed token
 * (`htv1.<payload>.<sig>` — see `QrCodeService`), and each client encodes it
 * itself. The mobile app does the same via `react-native-qrcode-svg`. Passing
 * that token to an `<img src>` renders a broken image, which is what this
 * page did before.
 *
 * Encoding client-side also means the QR is never fetched cross-origin, so the
 * canvas used by the download/share path is never tainted.
 */
export function TicketQr({
  token,
  size = 220,
  className,
}: {
  token: string;
  size?: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(token, {
      width: size * 2, // 2x so it stays crisp on a retina screen
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0A0A0FFF", light: "#FFFFFFFF" },
    })
      .then((url) => alive && setDataUrl(url))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [token, size]);

  if (failed) {
    return (
      <div
        className="grid place-items-center rounded-xl bg-neutral-100 p-4 text-center"
        style={{ width: size, height: size }}
      >
        <p className="text-helper text-neutral-600">
          Couldn&apos;t draw the QR code. Your reference below still works at
          the door.
        </p>
      </div>
    );
  }

  return (
    // Reserve the space before the QR resolves so the card doesn't jump.
    <div style={{ width: size, height: size }} className={className}>
      {dataUrl ? (
        /* A data: URL has nothing for next/image to optimise, and routing it
         * through the optimizer would round-trip the whole payload through
         * the server for no gain. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={dataUrl}
          alt="Ticket QR code"
          width={size}
          height={size}
          className="size-full object-contain"
        />
      ) : (
        <div className="size-full animate-pulse rounded-xl bg-neutral-200" />
      )}
    </div>
  );
}
