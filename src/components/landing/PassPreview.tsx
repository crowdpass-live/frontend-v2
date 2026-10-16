import type { CSSProperties } from "react";
import QRCode from "qrcode";
import { Logo } from "../Logo";
import { CheckCircleIcon } from "../icons";

/**
 * The hero's illustration: a CrowdPass pass, drawn in markup rather than
 * shipped as a picture, so it is crisp at any density, repaints with the
 * tokens, and costs no image request on 4G.
 *
 * The QR is real — it encodes the site's own address, so anyone who points a
 * phone at the hero lands back here rather than on a dead end. It is drawn as
 * one SVG path from the module matrix (server-side, no canvas) and fills with
 * `currentColor`, which keeps hex out of the component.
 *
 * A sample, not a ticket: nothing on it claims to be a real event.
 */
const QR_TARGET =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.crowdpazz.com";

function qrPath(text: string): { d: string; size: number } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  let d = "";
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return { d, size: modules.size };
}

export function PassPreview({ className }: { className?: string }) {
  const qr = qrPath(QR_TARGET);

  return (
    <div className={className} aria-hidden>
      <div className="relative mx-auto w-full max-w-[340px]">
        {/* The glow is the one loud thing on the page, and it sits behind
         * everything, blurred until it is light rather than colour. */}
        <div className="absolute -inset-10 rounded-full bg-accent/25 blur-3xl" />

        {/* A second pass peeking out behind: a stack reads as "your tickets",
         * a lone card as "a card". */}
        <div className="absolute inset-0 translate-x-5 translate-y-4 rotate-6 rounded-[28px] border border-border bg-surface-strong" />

        <div
          className="pass-float relative overflow-hidden rounded-[28px] border border-border-strong bg-surface shadow-2xl shadow-black/60"
          style={{ "--pass-tilt": "-3deg" } as CSSProperties}
        >
          {/* Header band: the maroon tint, not solid orange — the mark is
           * orange and would vanish on it. */}
          <div className="flex items-center justify-between gap-3 border-b border-accent-tint-border bg-accent-tint px-6 py-5">
            <Logo variant="mark" height={22} />
            <span className="text-helper font-bold uppercase tracking-[0.18em] text-accent">
              Admit one
            </span>
          </div>

          <div className="flex flex-col gap-5 px-6 pb-6 pt-5">
            <div className="flex flex-col gap-1">
              <span className="text-helper uppercase tracking-[0.18em] text-text-faint">
                Event
              </span>
              <span className="text-title font-bold text-text">
                Your next night out
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-4 text-label">
              <div className="flex flex-col gap-1">
                <dt className="text-helper text-text-faint">Date</dt>
                <dd className="font-semibold text-text">Sat · 8pm</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-helper text-text-faint">Ticket</dt>
                <dd className="font-semibold text-text">General</dd>
              </div>
            </dl>
          </div>

          {/* Perforation: two notches cut from the page colour and a dashed
           * tear line between them. */}
          <div className="relative h-0">
            <span className="absolute -left-3 -top-3 size-6 rounded-full border border-border-strong bg-bg" />
            <span className="absolute -right-3 -top-3 size-6 rounded-full border border-border-strong bg-bg" />
            <span className="absolute inset-x-6 top-0 border-t border-dashed border-border-strong" />
          </div>

          <div className="flex items-center gap-5 px-6 pb-6 pt-6">
            <div className="shrink-0 rounded-xl bg-text p-2 text-ink">
              <svg
                viewBox={`0 0 ${qr.size} ${qr.size}`}
                className="block size-[88px]"
                shapeRendering="crispEdges"
              >
                <path d={qr.d} fill="currentColor" />
              </svg>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-ok/15 px-3 py-1 text-helper font-medium text-ok">
                <CheckCircleIcon width={14} height={14} />
                Verified
              </span>
              <span className="text-helper text-text-dim">
                Signed, minted on-chain, scanned at the door.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
