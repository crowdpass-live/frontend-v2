"use client";

import { useEffect, useRef, useState } from "react";
import { createQrDetector } from "@/lib/qr-detector";

/** Decode attempts per second. A decoder every animation frame burns the
 * battery of a phone that has to last the whole door. */
const SCAN_INTERVAL_MS = 250;

export type ScannerProblem =
  | "denied"
  | "no-camera"
  | "insecure"
  | "unsupported"
  | "failed";

const PROBLEM_COPY: Record<ScannerProblem, string> = {
  // Permission denied is sticky in a browser and there is no "open
  // settings" link to offer, unlike the app. Say how, and point at the
  // fallbacks that always work.
  denied:
    "Camera access is blocked for this site. Allow it in your browser's site settings (the icon beside the address), then reload — or enter the ticket code, or find the guest by name in the guest list.",
  "no-camera": "No camera was found on this device. Enter the ticket code or find the guest by name instead.",
  insecure: "The camera only works over a secure (https) connection. Enter the ticket code or find the guest by name instead.",
  unsupported: "This browser can't use the camera. Enter the ticket code or find the guest by name instead.",
  failed: "The camera couldn't start. Close other apps using it and try again, or enter the code instead.",
};

/**
 * The camera half of the door scanner (#46). Hands each decoded string to
 * `onCode` untouched — it does not parse, because the door sends it to
 * `resolve-qr` as-is — and stops decoding while `paused`, so one ticket is
 * one result, not a burst of them.
 *
 * The camera is released when this unmounts AND whenever the tab is hidden:
 * a door phone left with a hot camera is flat before the queue is done.
 */
export function QrScanner({
  paused,
  onCode,
}: {
  paused: boolean;
  onCode: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);
  const [problem, setProblem] = useState<ScannerProblem | null>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Read inside the loop without restarting the camera on every render.
  useEffect(() => {
    pausedRef.current = paused;
    onCodeRef.current = onCode;
  });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      setReady(false);
    };

    async function start() {
      if (!window.isSecureContext) return setProblem("insecure");
      if (!navigator.mediaDevices?.getUserMedia) return setProblem("unsupported");
      try {
        const detector = await createQrDetector();
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (stopped) return stop();
        const video = videoRef.current;
        if (!video) return stop();
        video.srcObject = stream;
        await video.play();
        setProblem(null);
        setReady(true);

        const tick = async () => {
          if (stopped || !stream) return;
          if (!pausedRef.current && video.readyState >= 2) {
            try {
              const code = await detector.detect(video);
              if (code && !pausedRef.current) onCodeRef.current(code);
            } catch {
              // One bad frame is not a broken scanner; try the next.
            }
          }
          timer = setTimeout(tick, SCAN_INTERVAL_MS);
        };
        tick();
      } catch (err) {
        stop();
        const name = err instanceof DOMException ? err.name : "";
        setProblem(
          name === "NotAllowedError" || name === "SecurityError"
            ? "denied"
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "no-camera"
              : "failed",
        );
      }
    }

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (!stream && !stopped) void start();
    };

    void start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [attempt]);

  if (problem) {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
        <p className="text-body text-text-dim" role="alert">
          {PROBLEM_COPY[problem]}
        </p>
        {problem === "failed" ? (
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="inline-flex min-h-10 w-fit items-center text-label font-bold text-accent"
          >
            Try the camera again
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
    <div className="relative aspect-square w-full overflow-hidden rounded-card bg-ink sm:aspect-video">
      {/* muted + playsInline: iOS will not autoplay a camera stream otherwise. */}
      <video
        ref={videoRef}
        muted
        playsInline
        aria-label="Camera view for scanning ticket QR codes"
        className="h-full w-full object-cover"
      />
      {/* A frame to aim with; the whole image is decoded regardless. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-[18%] rounded-card border-2 border-white/70 sm:inset-y-[12%] sm:inset-x-[30%]"
      />
      {!ready ? (
        <p className="absolute inset-0 grid place-items-center text-label text-white/80">
          Starting camera…
        </p>
      ) : paused ? (
        <div className="absolute inset-0 bg-ink/60" aria-hidden />
      ) : null}
    </div>
    <p className="text-center text-helper text-text-faint">
      Point the camera at the ticket&apos;s QR code.
    </p>
    </div>
  );
}
