import Image from "next/image";

/**
 * The CrowdPass logo.
 *
 * These are the delivered brand rasters from the crowdpass skill
 * (`assets/design/brand/`), copied into `public/brand/`. There is no vector
 * source — design open issue #12 — so they are PNG, and they are the source of
 * truth. Do not re-draw the mark by hand: an approximation of a company's logo
 * is worse than a raster of the real one.
 *
 * `logo-full-dark` is the lockup *for dark backgrounds* (white wordmark), which
 * is the only kind this app has.
 *
 * Note what the real wordmark does: "Crowd" is bold and "Pass" is light, both
 * **white**. The orange lives in the mark, not in the type. A hand-built
 * version of this had "Pass" in the brand orange, which is not the logo.
 */

/** Intrinsic aspect ratios, so layout is reserved before the image loads. */
const FULL = { w: 2770, h: 450 };
const MARK = { w: 2184, h: 1320 };

export function Logo({
  variant = "full",
  height = 28,
  priority,
  className,
}: {
  /** `full` = mark + wordmark; `mark` = the monogram alone. */
  variant?: "full" | "mark";
  /** Rendered height in px. Width follows from the intrinsic ratio. */
  height?: number;
  priority?: boolean;
  className?: string;
}) {
  const { w, h } =
    variant === "full" ? FULL : MARK;
  const src =
    variant === "full" ? "/brand/logo-full-dark.png" : "/brand/logo-mark.png";

  return (
    <Image
      src={src}
      alt="CrowdPass"
      width={Math.round((w / h) * height)}
      height={height}
      priority={priority}
      // Local asset, same-origin — unlike event covers this goes through
      // Next's optimizer, so a 2770px master is served at the size asked for.
      sizes={`${Math.round((w / h) * height)}px`}
      className={className}
    />
  );
}
