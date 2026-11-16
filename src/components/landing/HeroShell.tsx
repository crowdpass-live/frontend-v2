"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "../ui";

/**
 * The hero's <section>, and the one place the hero listens to the pointer.
 *
 * It does no layout and renders no state: it writes the pointer position into
 * CSS variables on the section, once per frame, and the stylesheet does the
 * rest — the pass tilts (`.hero-tilt`), its glare follows (`.pass-glare`),
 * the chips drift by depth (`.hero-depth`) and a soft spotlight trails the
 * cursor (`.hero-spotlight`). React never re-renders on a mouse move, and
 * everything inside stays a server component.
 *
 *   --px, --py   pointer from the section centre, -1…1
 *   --sx, --sy   pointer in px, for the spotlight
 *   --hover      1 while a fine pointer is over the section, else 0
 *
 * Only a fine pointer (mouse, trackpad) drives it, and not under
 * `prefers-reduced-motion`: a phone gets the idle float and nothing chasing
 * its finger.
 */
export function HeroShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || still.matches) return;

    let frame = 0;
    let last: PointerEvent | null = null;

    const paint = () => {
      frame = 0;
      if (!last) return;
      const r = el.getBoundingClientRect();
      const x = last.clientX - r.left;
      const y = last.clientY - r.top;
      el.style.setProperty("--sx", `${x}px`);
      el.style.setProperty("--sy", `${y}px`);
      el.style.setProperty("--px", ((x / r.width) * 2 - 1).toFixed(3));
      el.style.setProperty("--py", ((y / r.height) * 2 - 1).toFixed(3));
    };

    const onMove = (e: PointerEvent) => {
      last = e;
      el.style.setProperty("--hover", "1");
      if (!frame) frame = requestAnimationFrame(paint);
    };

    // Let go: everything eases home rather than freezing where the
    // pointer left.
    const onLeave = () => {
      last = null;
      el.style.setProperty("--hover", "0");
      el.style.setProperty("--px", "0");
      el.style.setProperty("--py", "0");
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <section ref={ref} className={cx("hero relative isolate overflow-hidden", className)}>
      {children}
    </section>
  );
}
