"use client";

import Image from "next/image";
import { useState } from "react";
import { resolveImageUrl } from "@/lib/images";

/** Diagonal-stripe stand-in, matching the mobile app's `photoStripe`. */
export const STRIPE =
  "repeating-linear-gradient(135deg,#141414,#141414 11px,#1c1c1c 11px,#1c1c1c 22px)";

/**
 * An event cover that survives a dead image URL.
 *
 * Organizer covers are commonly IPFS gateway links (`ipfs.io/ipfs/<cid>`), and
 * those gateways time out often enough that this is routine, not an edge case
 * — one was 504-ing after 28 seconds while this was written. Two failure modes
 * both have to look deliberate:
 *
 *   - **Slow:** an `<img>` with nothing behind it shows the browser's
 *     broken-image glyph for the whole wait, so the stripe is always painted
 *     underneath and the image fades in over it.
 *   - **Dead:** `onError` drops the `<img>` entirely, leaving the stripe.
 *
 * `unoptimized` because covers are organizer-uploaded to S3/R2/IPFS, so the
 * host set is open-ended and can't be enumerated in `next.config.ts` — a new
 * CDN host would otherwise 500 the whole page.
 */
export function CoverImage({
  src,
  sizes,
  priority,
  className,
}: {
  src: string | null;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Applied here, not at each call site, so every cover on the site goes
  // through the same gateway rule.
  const resolved = resolveImageUrl(src);

  return (
    <>
      <div aria-hidden className="absolute inset-0" style={{ background: STRIPE }} />
      {resolved && !failed ? (
        <Image
          src={resolved}
          alt=""
          fill
          unoptimized
          priority={priority}
          sizes={sizes}
          className={`object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          } ${className ?? ""}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </>
  );
}
