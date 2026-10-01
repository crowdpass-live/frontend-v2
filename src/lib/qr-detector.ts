"use client";

/**
 * A QR detector for the door scanner (#46), in two tiers:
 *
 * 1. The native `BarcodeDetector` where it exists and reads QR — Chrome on
 *    Android, most desktop Chromium. Fast, and nothing to download.
 * 2. The `barcode-detector` ponyfill (zxing-wasm) everywhere else, which
 *    above all means **iOS Safari**: it has `getUserMedia` but no
 *    `BarcodeDetector`, and it is the single most likely phone at a door.
 *
 * The ponyfill is imported only when needed, and its ~1 MB WASM is served
 * from this site (`scripts/copy-zxing-wasm.mjs` puts it under
 * `/zxing/<version>/`), not barcode-detector's default jsDelivr URL.
 *
 * Returns the raw decoded string. Never parse it here: the door sends it to
 * `POST /tickets/resolve-qr` untouched, because mobile tickets encode a bare
 * reference and web/email tickets a signed `htv1.` token.
 */

interface DetectedCode {
  rawValue: string;
}

interface Detector {
  detect(source: CanvasImageSource): Promise<DetectedCode[]>;
}

interface DetectorClass {
  new (options: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
}

export interface QrDetector {
  /** Which tier is in use — shown nowhere, but useful when debugging a door. */
  kind: "native" | "wasm";
  /** The first QR in the frame, or null. */
  detect(source: CanvasImageSource): Promise<string | null>;
}

function wrap(detector: Detector, kind: QrDetector["kind"]): QrDetector {
  return {
    kind,
    async detect(source) {
      const codes = await detector.detect(source);
      const value = codes.find((c) => c.rawValue)?.rawValue;
      return value ? value : null;
    },
  };
}

let cached: Promise<QrDetector> | null = null;

export function createQrDetector(): Promise<QrDetector> {
  cached ??= (async () => {
    const Native = (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    if (Native) {
      try {
        if ((await Native.getSupportedFormats()).includes("qr_code")) {
          return wrap(new Native({ formats: ["qr_code"] }), "native");
        }
      } catch {
        // A BarcodeDetector that throws on getSupportedFormats is as good as
        // none; fall through to WASM.
      }
    }

    const { BarcodeDetector, setZXingModuleOverrides, ZXING_WASM_VERSION } =
      await import("barcode-detector/ponyfill");
    setZXingModuleOverrides({
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? `/zxing/${ZXING_WASM_VERSION}/${path}` : prefix + path,
    });
    return wrap(new BarcodeDetector({ formats: ["qr_code"] }) as Detector, "wasm");
  })();
  // A failed load (offline mid-download) must be retryable, not cached.
  cached.catch(() => {
    cached = null;
  });
  return cached;
}
