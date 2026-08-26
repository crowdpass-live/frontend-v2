# CrowdPass Web

The buyer-facing web surface for CrowdPass. Scope is the guest purchase path:
a shared link opens an event, and someone with no account walks out with a
ticket.

```
/                         discover            search · category · location
/events/[slug]            event detail        server-rendered, OG-scrapeable
/events/[slug]/checkout   guest checkout      tier · quantity · details · rail
/checkout/callback        payment return      polls settlement → 3 states
/tickets/[reference]      the ticket + QR     public, no account needed
```

Auth and the organizer dashboard are **not** in this build.

## Discover (`/`)

Filters live in the URL (`?search=&category=&location=&page=`), so a filtered
view is shareable, survives the back button, and is fetched server-side.

Two things it has to do that the API does not:

**Exclude past events.** `GET /events` does *not* filter them out and sorts by
`startTime` ascending — so an unfiltered first page is the **oldest** events in
the database, whose sales closed months ago. `fetchUpcomingEvents()` passes
`startDate=now`. Never call `fetchEvents()` bare for a browse surface.

**Reject unknown categories.** The backend 400s on an enum miss, so a
hand-edited `?category=` is validated against the enum and dropped if it
doesn't match, rather than breaking the page.

The category chips use the real `EventCategory` enum, not the design's row —
`10-discover-home.png` shows a "Weddings" chip, which is not a category the API
accepts and would filter to nothing forever (design open issue #6).

## Running it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

`NEXT_PUBLIC_API_URL` points at the backend, including the `/api` prefix the
NestJS app sets globally. Defaults to the deployed backend; see `.env.example`.

## How the purchase actually works

```
POST /api/tickets/purchase          ← the guest endpoint: @Public() +
  (no auth token)                     OptionalJwtAuthGuard. The backend upserts
                                      a User row from buyerEmail so the mint
                                      worker has a wallet to mint into.
  → { reference, checkoutUrl }
  → window.location.assign(checkoutUrl)   the gateway must own the tab
  → gateway redirects to /checkout/callback?reference=…
  → GET /api/payments/verify?reference=   idempotent; SETTLES the transaction
                                          even if the provider webhook never
                                          arrives. Polled with backoff.
  → /tickets/[reference]
```

Three things worth knowing before changing any of it:

**The buyer is never shown a fee.** They pay the advertised ticket price and
nothing more; the 5% platform fee is organizer-side and deducted at
settlement. This resolves open issue #2 in the design doc the same way the
mobile app resolved it. Do not add a fee row without changing both surfaces.

**`PENDING` is not a failure.** Nigerian bank transfer and USSD confirm
asynchronously, sometimes minutes later. The callback page holds a pending
state and keeps polling; it gives up auto-polling at 12 minutes and offers a
manual re-check. The poll cadence mirrors the mobile app's `FiatPaymentScreen`
so the two surfaces behave identically.

**Payment rails come from the API, never from a default.** `GET
/api/payments/methods?eventId=` only lists a fiat provider once the organizer
has a real gateway subaccount. Hardcoding `PAYSTACK` would hand buyers a
button that always fails at gateway init.

### `returnUrl` and the backend

Checkout sends `returnUrl` so the gateway redirects back here rather than to
the API's own result page (which is built for the mobile WebView). The backend
allowlists it against `CORS_ORIGINS` / `APP_URL` before use — an unrecognised
origin is dropped, because an open redirect there would let anyone mint a
gateway checkout that bounces the buyer onto a phishing page carrying a real
payment reference.

The backend runs `ValidationPipe({ forbidNonWhitelisted: true })`, so a
deployment that predates the `returnUrl` DTO field rejects the *whole*
purchase. `purchaseTicket()` feature-detects this and retries once without the
field, so the frontend can ship ahead of the API. That retry is safe only
because validation runs before the controller — the rejected attempt creates
no transaction and reserves no seat. **Never retry a purchase on any other
error.**

## Deploying

Production is **https://www.crowdpazz.com** (Vercel).

> **The `www` is load-bearing.** `https://crowdpazz.com` 308-redirects to
> `https://www.crowdpazz.com`, so `www` is the origin a browser actually
> sends. Every place the origin is configured must use it.

- `NEXT_PUBLIC_API_URL` — the backend's `/api` origin. This is the API, not
  this site; it does not change when the site moves.
- `NEXT_PUBLIC_SITE_URL` — this site's own origin, for `metadataBase`. Link
  previews are the shopfront for a product shared over WhatsApp, and a
  relative OG URL silently yields no image.
- Backend **`CORS_ORIGINS`** and **`APP_URL`** must both contain this origin
  (set in `backend-v2/render.yaml`). Two distinct failures if they don't:
  - CORS missing → the browser blocks every client-side call. The page renders
    perfectly and simply cannot sell anything.
  - returnUrl allowlist missing → checkout still works, but every buyer lands
    on the API's mobile callback page instead of `/checkout/callback`. This
    one is silent; nothing errors.

## Event covers and IPFS

Covers are uploaded to **Pinata** (see the mobile app's `src/lib/ipfs.js`), but
the URL stored on the event points at `ipfs.io` — a different gateway that has
to re-fetch the content over the IPFS network, and which currently returns
**504** for CrowdPass CIDs. Because that error body is `text/plain`, Chrome then
refuses to render it as an image (`ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`). The
net effect was that every event cover was broken.

`resolveImageUrl()` (`src/lib/images.ts`) rewrites the gateway host onto
`NEXT_PUBLIC_IPFS_GATEWAY`, leaving the CID untouched. The same CIDs serve fine
from Pinata, where they are already pinned.

For production, point it at a **dedicated** Pinata gateway
(`<name>.mypinata.cloud`) — the shared public one is rate-limited. The real fix
is upstream: store a working URL (or a bare CID) on the event, so every client
isn't patching this independently.

`CoverImage` also has to survive a dead or slow URL regardless of gateway: the
stripe placeholder is always painted underneath, and `onError` drops the
`<img>`. Without the backdrop, a slow gateway shows the browser's broken-image
glyph for the whole wait.

## Responsive layout

Mobile-first, but the desktop layouts are designed, not stretched. Two container
widths (`Container size="reading" | "page"`, `src/components/ui.tsx`):

- **`reading`** (560px) — checkout form, ticket, payment result, 404. These
  never widen: a 1400px-wide form is harder to fill in than a 560px one, and a
  ticket is a card, not a page.
- **`page`** (1152px) — discover and the event page, which have genuine
  parallel content and earn the room.

What changes where:

| | phone | `sm` 640 | `lg` 1024 |
|---|---|---|---|
| Discover list | compact rows | 2-col card grid | 3-col |
| Discover filters | search → chips → location | — | search + location on one row |
| Featured card | 4:3 | 16:9 | 21:9, content on one row |
| Event page | single column + fixed CTA bar | — | details + **sticky ticket rail** |
| Checkout | single column + fixed pay bar | — | form + **sticky order summary** |

Two rules held throughout:

**One element, two positions — never two elements.** The checkout summary is a
fixed bottom bar on a phone and a sticky sidebar card from `lg`, but it is the
same node with responsive classes. Rendering it twice would put two submit
buttons in one form, and the browser treats the first as the implicit submit on
Enter — so the button you see and the button that fires could differ by
breakpoint. The event page's CTA is the one deliberate exception (a `Link`, not
a submit), and there each variant is explicitly hidden at the other breakpoint.

**Only the chip strip may overflow.** The category row scrolls horizontally on
narrow screens inside its own `overflow-x-auto`; nothing else is allowed past
the viewport edge. `scratchpad/e2e-responsive.mjs` asserts this at seven widths
from 320px to 1728px, ignoring elements inside a scroll container.

## Brand assets

Copied from the crowdpass skill (`assets/design/`) and the mobile app
(`v2-mobile/assets/`). Two deliberate sourcing choices:

**Logos are the delivered rasters, not a redraw.** `public/brand/*.png` come
straight from `assets/design/brand/`. There is no vector source — design open
issue #12 — and an approximation of a company's own logo is worse than a raster
of the real one. `logo-full-dark` is the lockup *for dark backgrounds*, the only
kind this app has.

> The real wordmark is "Crowd" **bold white** + "Pass" **light white**. The
> orange lives in the mark, not in the type. A hand-built version of this had
> "Pass" in the brand orange, which is not the logo.

**Mascots come from `v2-mobile`, not from the skill.** The skill's
`assets/design/mascots/*.svg` are rasters in SVG clothing with dark captions
baked into the artwork (design open issue #13) — unreadable on `#08090D`, and
they repeat the copy already sitting beside them. The mobile crops are art-only.
`no-tickets` is the exception: that illustration carries no caption, so the
skill's SVG is used directly.

Poses in use: `success` and `error` on the payment result, `error` on 404,
`no-tickets` on an empty search. The waiting state keeps a spinner —
`mascot-pending` exists but has its caption baked in, and a spinner *moves*,
which is the honest signal for a page that is actively polling. Swap it in if an
art-only re-export lands.

`src/app/icon.png` and `apple-icon.png` are the 1024² app icon, already composed
on the brand background. `src/app/opengraph-image.png` is the default link
preview — generated once with the browser, since no image library is available
here; regenerate with `scratchpad/make-og.mjs` if the brand changes.

## Design

Dark-only, mobile-first. Tokens in `src/app/globals.css` are ported 1:1 from
the mobile app's `src/theme.js`, itself measured off the Figma exports in the
crowdpass skill (`assets/design/mobile/`). The PNGs are the source of truth —
when they change, re-measure there and mirror here.

Nothing should hardcode a hex. Two rules are easy to miss: **text on an orange
button is black**, and **status pills are tinted fills with coloured text**,
never solid.

`Button`/`ButtonLink` deliberately carry no width. `w-full` in the shared base
and `w-auto` at a call site are both `width` utilities, so which wins depends
on stylesheet order, not class order — the override loses silently and the
button eats its neighbours. Every call site states its own width.
