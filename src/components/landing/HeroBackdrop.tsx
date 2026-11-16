"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * The crowd behind the hero: a still that paints with the page, and a short
 * loop of the same shot that takes over once it can play.
 *
 * The still is the clip's first frame, so it doubles as the seam: in the last
 * moments of each pass the video fades out onto the still and fades back in
 * from frame one. A five-second clip loops without the jump cut a plain
 * `loop` would show.
 *
 * The video is a nicety, so it is the first thing to go:
 *   - `prefers-reduced-motion` → the still only;
 *   - Save-Data on, or a 2G/3G connection → the still only (a few MB of
 *     concert haze is not worth someone's data bundle);
 *   - off-screen → paused.
 */
const STILL = "/landing/hero-crowd.webp";
const CLIP = "/landing/hero-crowd.mp4";
/** Seconds before the end at which the clip starts fading onto the still. */
const SEAM = 0.7;

type NetworkInformation = { saveData?: boolean; effectiveType?: string };

const REDUCED = "(prefers-reduced-motion: reduce)";

/** Re-checks if the visitor flips reduced motion while the page is open. */
function subscribe(onChange: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function canAffordVideo(): boolean {
  if (window.matchMedia(REDUCED).matches) return false;
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && /(^|-)(2g|3g)$/.test(conn.effectiveType)) return false;
  return true;
}

export function HeroBackdrop() {
  const video = useRef<HTMLVideoElement>(null);
  // The server (and the first paint) always says "still".
  const play = useSyncExternalStore(subscribe, canAffordVideo, () => false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!play || !v) return;

    const onTime = () => {
      if (v.duration && v.duration - v.currentTime < SEAM) setShown(false);
    };
    const onEnded = () => {
      v.currentTime = 0;
      void v.play().catch(() => {});
    };
    const onPlaying = () => setShown(true);

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    v.addEventListener("playing", onPlaying);

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void v.play().catch(() => {});
      else v.pause();
    });
    io.observe(v);

    return () => {
      io.disconnect();
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("playing", onPlaying);
    };
  }, [play]);

  return (
    <div className="hero-backdrop absolute inset-0 -z-20" aria-hidden>
      <Image
        src={STILL}
        alt=""
        fill
        preload
        sizes="100vw"
        className="object-cover object-[70%_center]"
      />
      {play && (
        <video
          ref={video}
          src={CLIP}
          muted
          playsInline
          autoPlay
          preload="auto"
          className="absolute inset-0 size-full object-cover object-[70%_center] transition-opacity duration-700 ease-out"
          style={{ opacity: shown ? 1 : 0 }}
        />
      )}
    </div>
  );
}
