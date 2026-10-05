import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { errorResponse } from "@/lib/route-response";

/**
 * `POST /api/uploads/cover` — pin an event cover to IPFS (#37).
 *
 * The backend has no upload endpoint: `coverImage` is `@IsUrl()`, a URL the
 * client hosts itself. Mobile uploads straight to Pinata with a JWT in its
 * bundle; on the web that key would sit in JavaScript anyone can read. So it
 * lives here, server-only (`PINATA_JWT`, never `NEXT_PUBLIC_`), and this
 * handler is the only thing that can spend it:
 *
 * - **Same origin only.** A multipart POST is a "simple" request a foreign
 *   page could send; the session cookie is SameSite=Lax, and the Origin
 *   check refuses a same-site-but-foreign origin (another preview) too.
 * - **Organizers only.** Read from `/auth/me` per request — the JWT's role
 *   claim goes stale — so a buyer account can't use our pinning quota.
 * - **Checked server-side.** The browser's `accept` and the client's type
 *   are hints: the bytes must be a JPEG, PNG or WebP, and at most 4MB —
 *   under Vercel's 4.5MB request cap, and the client compresses covers to
 *   a few hundred KB anyway.
 *
 * Returns `{ url, cid }`. The URL is on the configured gateway, not
 * `ipfs.io` (which 504s for CrowdPass CIDs), so what the event stores works
 * as stored.
 */

const MAX_BYTES = 4 * 1024 * 1024;
/** Overridable only to point tests at a stand-in; production uses Pinata's. */
const PINATA_PIN_URL = `${(process.env.PINATA_API_URL || "https://api.pinata.cloud").replace(/\/+$/, "")}/pinning/pinFileToIPFS`;

/** The gateway the stored URL points at. A dedicated one in production. */
function gatewayBase(): string {
  const configured =
    process.env.PINATA_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_IPFS_GATEWAY ||
    "https://gateway.pinata.cloud/ipfs";
  return configured.replace(/\/+$/, "");
}

/** The real type, from the first bytes — never the client's say-so. */
function sniff(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const b = (i: number) => bytes[i];
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return errorResponse(403, "Cross-origin request refused.");
  }

  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return errorResponse(503, "Cover uploads aren't set up on this deployment yet. Paste an image link instead.");
  }

  const user = await getCurrentUser().catch(() => null);
  if (!user) return errorResponse(401, "Sign in to upload a cover.");
  if (!user.isOrganizer) return errorResponse(403, "Only hosts can upload event covers.");

  // Refuse an oversized body before reading it, when the client says so.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES + 64 * 1024) {
    return errorResponse(413, "That image is too large. Covers can be up to 4MB.");
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return errorResponse(400, "Send the image as multipart form data in a field named \"file\".");
  }
  if (!(file instanceof File)) {
    return errorResponse(400, "No image was attached.");
  }
  if (file.size === 0) return errorResponse(400, "That image is empty.");
  if (file.size > MAX_BYTES) {
    return errorResponse(413, "That image is too large. Covers can be up to 4MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniff(bytes);
  if (!type) {
    return errorResponse(415, "Covers must be a JPEG, PNG or WebP image.");
  }

  // A fresh File from the checked bytes, with the sniffed type and our own
  // name — nothing the client chose is forwarded.
  const name = `crowdpass-cover-${user.id}-${Date.now()}.${EXTENSION[type]}`;
  const body = new FormData();
  body.append("file", new File([bytes], name, { type }));
  body.append("pinataMetadata", JSON.stringify({ name, keyvalues: { kind: "event-cover", userId: user.id } }));

  let res: Response;
  try {
    res = await fetch(PINATA_PIN_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return errorResponse(504, "The image host didn't respond. Please try again.");
  }

  if (!res.ok) {
    // The detail is for our logs, not the host: it can name our account.
    console.error("Pinata pin failed", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return errorResponse(502, "Couldn't upload the cover. Please try again.");
  }

  const data = (await res.json().catch(() => null)) as { IpfsHash?: unknown } | null;
  const cid = typeof data?.IpfsHash === "string" ? data.IpfsHash : null;
  if (!cid) return errorResponse(502, "Couldn't upload the cover. Please try again.");

  return NextResponse.json({ url: `${gatewayBase()}/${cid}`, cid });
}
