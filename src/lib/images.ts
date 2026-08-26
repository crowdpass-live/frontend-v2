/**
 * Which IPFS gateway to read event covers through.
 *
 * Covers are uploaded to **Pinata** (see the mobile app's `src/lib/ipfs.js`),
 * but the URL persisted on the event points at `ipfs.io`, which is a different
 * gateway that has to re-fetch the content over the IPFS network. That gateway
 * is currently returning **504** for CrowdPass CIDs — and because the error
 * body is `text/plain`, Chrome then refuses to render it as an image
 * (`ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`). The net effect is that every
 * event cover is broken.
 *
 * The same CIDs serve fine from Pinata, which is where they are pinned, so
 * this rewrites the gateway host while leaving the CID untouched. It is not a
 * new third-party dependency — it is the account the images already live in.
 *
 * For launch, prefer a **dedicated** Pinata gateway (`<name>.mypinata.cloud`)
 * over the shared public one, which is rate-limited. Set
 * `NEXT_PUBLIC_IPFS_GATEWAY` to override, or to `""` to disable rewriting and
 * use whatever URL the API returned.
 *
 * The real fix is upstream: store a working gateway URL (or a bare CID) on the
 * event in the first place, so every client isn't patching it independently.
 */
const GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs";

/** Matches any gateway-style IPFS URL and captures the CID + path after it. */
const IPFS_URL = /^https?:\/\/[^/]+\/ipfs\/(.+)$/i;
/** Matches the `ipfs://<cid>` protocol form. */
const IPFS_PROTOCOL = /^ipfs:\/\/(.+)$/i;

/**
 * Normalizes an event cover URL onto the configured gateway.
 *
 * Non-IPFS URLs (S3, R2, any CDN) pass through untouched — only the gateway
 * host of an IPFS URL is swapped, never the content hash.
 */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!GATEWAY) return trimmed;

  const base = GATEWAY.replace(/\/+$/, "");
  const viaProtocol = trimmed.match(IPFS_PROTOCOL);
  if (viaProtocol) return `${base}/${viaProtocol[1]}`;

  const viaGateway = trimmed.match(IPFS_URL);
  if (viaGateway) return `${base}/${viaGateway[1]}`;

  return trimmed;
}
