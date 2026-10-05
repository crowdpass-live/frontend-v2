/**
 * Event cover preparation, in the browser (#37). Mobile gets a 16:9 crop and
 * 0.8 JPEG compression free from the OS picker (`allowsEditing`,
 * `aspect: [16,9]`, `quality: 0.8`); the browser does not, so this does it
 * on a canvas before upload. A phone photo is 3–8MB; a 1600×900 JPEG at
 * 0.82 is a few hundred KB — under the upload route's 4MB cap, and kind to
 * Nigerian mobile data.
 */

export const COVER_WIDTH = 1600;
export const COVER_HEIGHT = 900;
const ASPECT = COVER_WIDTH / COVER_HEIGHT;
const QUALITY = 0.82;

/** What we accept from the picker. HEIC can't be decoded by most browsers. */
export const COVER_ACCEPT = "image/jpeg,image/png,image/webp";
/** A sanity cap on the ORIGINAL — it is compressed well below this. */
export const COVER_MAX_SOURCE_BYTES = 25 * 1024 * 1024;

export interface LoadedImage {
  bitmap: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  /** For the preview `<img>`; revoke with `URL.revokeObjectURL`. */
  previewUrl: string;
}

/** Decode a picked file, honouring EXIF orientation where supported. */
export async function loadImage(file: File): Promise<LoadedImage> {
  const previewUrl = URL.createObjectURL(file);
  try {
    if ("createImageBitmap" in window) {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { bitmap, width: bitmap.width, height: bitmap.height, previewUrl };
    }
  } catch {
    // Fall through to <img>, which some browsers decode where this can't.
  }
  const img = new Image();
  img.decoding = "async";
  img.src = previewUrl;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(previewUrl);
    throw new Error("That file couldn't be opened as an image. Try a JPEG or PNG.");
  }
  return { bitmap: img, width: img.naturalWidth, height: img.naturalHeight, previewUrl };
}

/**
 * The 16:9 window over the source, as a fraction along the axis that has
 * slack: 0 = top/left edge, 0.5 = centre, 1 = bottom/right. Only one axis
 * ever has slack, so one number is the whole crop.
 */
export function cropRect(width: number, height: number, focus: number) {
  const f = Math.min(1, Math.max(0, focus));
  if (width / height > ASPECT) {
    // Wider than 16:9: full height, slide horizontally.
    const w = Math.round(height * ASPECT);
    return { sx: Math.round((width - w) * f), sy: 0, sw: w, sh: height, axis: "x" as const };
  }
  const h = Math.round(width / ASPECT);
  return { sx: 0, sy: Math.round((height - h) * f), sw: width, sh: h, axis: "y" as const };
}

/** Crop, scale down (never up) and compress to a JPEG blob. */
export async function renderCover(image: LoadedImage, focus: number): Promise<Blob> {
  const { sx, sy, sw, sh } = cropRect(image.width, image.height, focus);
  const scale = Math.min(1, COVER_WIDTH / sw);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't prepare images. Try another browser.");
  // A transparent PNG would turn black as JPEG; give it the card colour.
  ctx.fillStyle = "#141414";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image.bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("Couldn't prepare the image. Please try another one.");
  return blob;
}

/**
 * Upload through our route handler. Throws an Error whose message is meant
 * for the host; `status` is set so callers can offer the link fallback on 503.
 */
export async function uploadCover(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", new File([blob], "cover.jpg", { type: "image/jpeg" }));
  let res: Response;
  try {
    res = await fetch("/api/uploads/cover", { method: "POST", body: form });
  } catch {
    throw Object.assign(new Error("Couldn't reach CrowdPass. Check your connection and try again."), { status: 0 });
  }
  const body = (await res.json().catch(() => null)) as { url?: string; message?: string } | null;
  if (!res.ok || !body?.url) {
    throw Object.assign(new Error(body?.message ?? "Couldn't upload the cover. Please try again."), {
      status: res.status,
    });
  }
  return body.url;
}
