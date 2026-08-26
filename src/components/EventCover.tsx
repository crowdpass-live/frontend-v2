"use client";

import Image from "next/image";
import { useState } from "react";
import { Badge } from "./ui";

/** Diagonal-stripe stand-in, matching the mobile app's `photoStripe`. */
const STRIPE =
  "repeating-linear-gradient(135deg,#141414,#141414 11px,#1c1c1c 11px,#1c1c1c 22px)";

/**
 * The event's hero image with the title and category chip laid over its
 * bottom edge (design `12-event-detail.png`).
 *
 * A client component purely so it can recover from a dead cover URL. Organizer
 * covers are commonly IPFS gateway links (`ipfs.io/ipfs/<cid>`), and those
 * gateways time out often enough that a broken-image icon at the top of the
 * page is a routine outcome, not an edge case — one was 504-ing while this was
 * written. On error it falls back to the stripe placeholder, which looks
 * deliberate rather than broken.
 *
 * `unoptimized` because covers are organizer-uploaded to S3/R2/IPFS, so the
 * host set is open-ended and can't be enumerated in `next.config.ts` — a new
 * CDN host would otherwise 500 the whole page.
 */
export function EventCover({
  src,
  title,
  category,
}: {
  src: string | null;
  title: string;
  category: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const showImage = !!src && !failed;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface sm:aspect-[16/10]">
      {/* Always painted, and always underneath. A cover on a slow IPFS gateway
       * can hang for half a minute before it either arrives or fails, and an
       * <img> with nothing behind it renders as the browser's broken-image
       * glyph for that whole time. With the stripe underneath, a slow or dead
       * cover reads as a deliberate placeholder either way. */}
      <div aria-hidden className="absolute inset-0" style={{ background: STRIPE }} />

      {showImage ? (
        <Image
          src={src}
          alt=""
          fill
          priority
          unoptimized
          sizes="(max-width: 560px) 100vw, 560px"
          className={`object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}

      {/* Not decoration: the title sits directly on the photo, and a bright
       * cover would otherwise render white text unreadable. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-bg via-bg/85 to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-6">
        {category ? <Badge tone="accent">{category}</Badge> : null}
        <h1 className="text-title font-bold text-text text-balance sm:text-display">
          {title}
        </h1>
      </div>
    </div>
  );
}
