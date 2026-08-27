import QRCode from "qrcode";

/**
 * Renders a shareable ticket card to a PNG, drawn on a canvas rather than
 * screenshotted from the DOM.
 *
 * Why not html-to-image / html2canvas: those re-implement CSS layout and are
 * reliably wrong about exactly the things this card is made of — webfonts,
 * background gradients, `object-fit`. Drawing it means the output is
 * deterministic, identical on every browser, and sized for sharing rather
 * than for whatever viewport the buyer happened to have.
 *
 * The QR is generated here from the signed token, so nothing is fetched
 * cross-origin and the canvas is never tainted — `toBlob` always succeeds.
 */

export interface TicketImageInput {
  eventName: string;
  tierName: string;
  whenLabel: string;
  whereLabel: string;
  holder: string;
  reference: string;
  /** The signed `htv1.…` token from `ticket.qrCode`. */
  qrToken: string;
}

/** Portrait, and a size that survives WhatsApp's re-encode. */
const W = 1080;
const H = 1620;

const BG = "#08090D";
const ACCENT = "#FE5722";
const ACCENT_DEEP = "#C43C11";
const TEXT = "#FFFFFF";
const DIM = "#A8A8A8";

/** Space Grotesk if the page already loaded it, else a sane stack. */
const font = (weight: number, size: number) =>
  `${weight} ${size}px "Space Grotesk", ui-sans-serif, system-ui, sans-serif`;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Truncates to fit `maxWidth`, appending an ellipsis only if it had to. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + "…";
}

/** Wraps into at most `maxLines`, truncating the last one. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    lines[maxLines - 1] = fitText(ctx, lines[maxLines - 1], maxWidth);
  }
  return lines;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderTicketImage(
  t: TicketImageInput,
): Promise<Blob> {
  // Wait for the webfont, or the card renders in the fallback stack and looks
  // nothing like the site.
  try {
    await document.fonts.ready;
  } catch {
    // Font loading API unavailable — carry on with whatever is resolved.
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D canvas context");

  // --- background -------------------------------------------------------
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 120, 0, W * 0.85, 120, 900);
  glow.addColorStop(0, "rgba(254,87,34,0.22)");
  glow.addColorStop(1, "rgba(254,87,34,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const pad = 80;
  const cardW = W - pad * 2;

  // --- wordmark (drawn, not the logo raster: two weights of the same
  //     typeface reproduce the lockup exactly and need no image fetch) -----
  let y = 150;
  ctx.textBaseline = "alphabetic";
  ctx.font = font(700, 46);
  const crowdW = ctx.measureText("Crowd").width;
  ctx.fillStyle = TEXT;
  ctx.fillText("Crowd", pad, y);
  ctx.font = font(400, 46);
  ctx.fillText("Pass", pad + crowdW, y);

  // --- event name -------------------------------------------------------
  y += 110;
  ctx.font = font(700, 68);
  ctx.fillStyle = TEXT;
  for (const line of wrap(ctx, t.eventName, cardW, 2)) {
    ctx.fillText(line, pad, y);
    y += 82;
  }

  // --- when / where -----------------------------------------------------
  y += 12;
  ctx.font = font(400, 34);
  ctx.fillStyle = DIM;
  if (t.whenLabel) {
    ctx.fillText(fitText(ctx, t.whenLabel, cardW), pad, y);
    y += 50;
  }
  if (t.whereLabel) {
    ctx.fillText(fitText(ctx, t.whereLabel, cardW), pad, y);
    y += 50;
  }

  // --- QR panel, on white so it scans ------------------------------------
  const panelY = y + 40;
  const panelH = 780;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, pad, panelY, cardW, panelH, 40);
  ctx.fill();

  const qrSize = 560;
  const qrDataUrl = await QRCode.toDataURL(t.qrToken, {
    width: qrSize,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0A0A0FFF", light: "#FFFFFFFF" },
  });
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, pad + (cardW - qrSize) / 2, panelY + 60, qrSize, qrSize);

  ctx.textAlign = "center";
  ctx.font = font(700, 34);
  ctx.fillStyle = ACCENT_DEEP;
  ctx.fillText(t.reference, W / 2, panelY + panelH - 90);
  ctx.font = font(400, 26);
  ctx.fillStyle = "#666";
  ctx.fillText(t.tierName, W / 2, panelY + panelH - 44);
  ctx.textAlign = "left";

  // --- holder + footer ---------------------------------------------------
  const footY = panelY + panelH + 76;
  ctx.font = font(400, 28);
  ctx.fillStyle = DIM;
  ctx.fillText("Ticket holder", pad, footY);
  ctx.font = font(700, 34);
  ctx.fillStyle = TEXT;
  ctx.textAlign = "right";
  ctx.fillText(fitText(ctx, t.holder || "—", cardW * 0.6), W - pad, footY);
  ctx.textAlign = "left";

  ctx.font = font(400, 26);
  ctx.fillStyle = "#787879";
  ctx.fillText("Show this QR at the door", pad, footY + 60);

  // Accent rule along the bottom, matching the OG card.
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, H - 12, W, 12);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not encode the image")),
      "image/png",
    );
  });
}

/** `"Neon Nights: Rooftop"` -> `"neon-nights-rooftop-ticket.png"` */
export function ticketFileName(eventName: string, reference: string): string {
  const slug =
    eventName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "crowdpass";
  return `${slug}-${reference}.png`;
}
