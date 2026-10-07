# CrowdPass Web

The web surface for CrowdPass, at parity with the mobile app. Three people
use it, and the routes are grouped by who they are for:

- **the buyer**, who opens a shared link and walks out with a ticket, with no
  account needed. That path is still the shopfront and nothing in an account
  is allowed to slow it down;
- **the organizer**, who becomes a host, verifies, connects a bank, creates
  and publishes events, watches them sell and gets paid;
- **the door**, where whoever holds the phone scans tickets in.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before picking up an issue. This file
explains *why* things are the way they are.

```
(site)     guest, no account
/                                  discover         search · category · location
/events/[slug]                     event detail     server-rendered, OG-scrapeable
/events/[slug]/checkout            checkout         tier · quantity · details · rail
/checkout/callback                 fiat return      polls settlement → 3 states
/checkout/crypto/[reference]       USDC deposit     exact amount · QR · polls
/tickets/[reference]               the ticket + QR  public; the reference is the key

(auth)     signed out
/signup  /login  /verify-email  /forgot-password  /auth/reset-password

(account)  any signed-in user
/account                           profile          stats · USDC wallet card · details
/account/tickets                   my tickets       → /tickets/[reference]

(host)     organizers (a buyer here is offered "become a host")
/host                              dashboard        tiles · sold-by-event · cards
/host/verify                       identity (KYC)   BVN/NIN + NIBSS consent
/host/payout-account               bank             Paystack / Monnify subaccount
/host/payouts  /host/earnings      money            escrow payouts · partner earnings
/host/events/new                   create           → DRAFT
/host/events/[id]                  overview         analytics · price · payout · cancel
/host/events/[id]/edit             edit             DRAFT only
/host/events/[id]/attendees        roster + CSV     the only tier with contact details
/host/events/[id]/members          member lists     claim-only ticket types
/host/events/[id]/revenue-sharing  partners         shares of the organizer's cut
/host/events/[id]/team             check-in team    grant / revoke delegates

(door)     anyone with a door to work
/door                              your doors
/door/[eventId]                    console          scanner · manual entry · roster

admin      ADMIN accounts
/admin  /admin/status  /admin/login
```

## Who may see what

Route groups don't appear in URLs; they decide the chrome and the gate.
`src/proxy.ts` only checks that a live session cookie exists on `/account`,
`/host`, `/door` and `/admin`. *Who* may see a page is the group layout's
call, and none of it is the security boundary: the API checks the bearer and
ownership on every request, and a page renders in parallel with its layout.

**The door is gated on `GET /organizer/my-checkin-events` returning rows,
never on `isOrganizer`.** Check-in staff are ordinary `BUYER` accounts holding
an `EventTicketAdmin` grant; there is no staff role in the schema. Gating the
door on the organizer flag locks out exactly the people it exists for: the
friend handed a phone for the evening. An organizer may always scan their own
events, so the door list merges both.

**Three privacy tiers for one ticket, kept apart.** `/attendees` returns buyer
email and phone (organizer only); the door roster deliberately returns names
only; the public ticket lookup exposes a name. A component that renders
contact details is never reused on a door surface.

## The session

**The JWT lives in an httpOnly cookie**, not localStorage. Mobile keeps it in
`expo-secure-store`; the browser has no equivalent, and a cookie is what lets
server components render authenticated pages while the token never exists in
client JavaScript. Sign-in happens server-side (`POST /api/session`), so the
token goes API → route handler → cookie. Admin uses the same session; there
is exactly one way to be signed in.

- **Server-first.** Authenticated pages fetch in server components through
  `serverFetch()`. Client components call `apiFetch(path, { auth: true })`,
  which goes through `/api/backend/*`; that handler swaps the cookie for a
  bearer header and refuses cross-origin writes.
- **Read `role` from `/auth/me`, never from the token.** The token's copy is
  stamped at login; the API re-reads the user on every request, so a buyer who
  becomes a host is a host on the next page load, without signing in again.
- **No refresh token, no logout endpoint.** The backend issues a 24-hour JWT
  and that is the whole lifecycle. A 401 always means "sign in again", and
  every 401, server or browser, goes through one route that clears the cookie
  and comes back via `?next=`.

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
NestJS app sets globally. Copy `.env.example` to `.env.local`; it points at
**staging**, which is what day-to-day development runs against.

| Environment | API |
| --- | --- |
| Staging (`develop`) | `https://crowdpass-api-staging.onrender.com/api` |
| Production (`main`) | `https://backend-v2-gwuz.onrender.com/api` |
| Local backend | `http://localhost:3000/api` |

Production sells real tickets and takes real money. Point a local build at it
only when you specifically mean to, and never to "just check something".

> **Local dev against the deployed API needs `http://localhost:3000` in the
> backend's `CORS_ORIGINS`.** Now that production is locked to crowdpazz.com,
> browser calls from localhost are blocked — checkout renders but shows no
> payment methods, because `GET /payments/methods` never returns. The same
> omission makes `returnUrl` fall back to the API callback page locally, since
> `CORS_ORIGINS` is also the returnUrl allowlist. Either add localhost there or
> run the backend locally.

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

## Branching

`main` is production. **Nothing merges straight into it.**

```
feature branch → develop → (when we choose to ship) → main
```

`develop` is the integration branch and is tested against the staging API.
Open every pull request against `develop`; promoting `develop` to `main` is a
separate, deliberate decision, not the tail end of a feature.

## Deploying

Production is **https://www.crowdpazz.com** (Vercel).

Every non-production deploy must set `NEXT_PUBLIC_API_URL` explicitly. The
code falls back to the *production* API when it is unset (see `src/lib/api.ts`
for why), so a staging deploy that omits it will quietly sell real tickets.

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
the viewport edge. Organizer tables scroll inside their own container; they
never widen the page.

Both rules are checked by **`/dev/responsive-audit`** (`pnpm dev`, then open
it; 404 in production). It loads every route at seven widths from 320px to
1728px, flags any element past the right edge that isn't inside its own scroll
container, and flags any form with two visible submits. It measures elements
rather than page width, because `body { overflow-x: hidden }` would hide
page-level overflow. Signed in, it covers `/account`, `/host` and `/door` too.

## The ticket page

**A confirmed ticket often has no QR yet.** `qrCode` is written by
`MintFinalizerService.issueQrAndNotify`, which needs the `tokenId` from the
on-chain mint receipt — and the mint queue retries 5× with exponential backoff
from 10s. So between "payment settled" and "QR exists" there is a real window
of seconds to minutes, and a real possibility it never closes.

`TicketCredential` owns that window: it polls `GET /tickets/:reference` with
backoff, shows what is actually happening, and swaps in the QR + Download +
Share the moment the mint lands — no reload. Treating `CONFIRMED && qrCode` as
the single "is this ticket real" test hides the QR *and* both buttons during
the wait while still promising "Show this QR code at the door", which is what
buyers were hitting.

The copy leans on a fact worth knowing: **check-in does not need the QR.**
`verifyTicket` and `checkIn` both look the ticket up by `reference`, and the
scanner app has manual reference entry. A buyer whose mint is slow still gets
in, so the reference is shown large while the QR is pending.

**`ticket.qrCode` is not an image.** The backend stores the compact signed
token (`htv1.<payload>.<sig>`, see `QrCodeService`) and every client encodes it
itself — mobile via `react-native-qrcode-svg`, web via `TicketQr`. Passing that
token to an `<img src>` renders a broken image. Encoding client-side also keeps
the canvas untainted, which is what makes the download work at all.

**Download** renders a 1080×1620 share card on a canvas (`lib/ticket-image.ts`)
rather than screenshotting the DOM. html-to-image and html2canvas re-implement
CSS layout and are reliably wrong about exactly what this card is made of —
webfonts, gradients, `object-fit`. Drawing it means the output is identical on
every browser and sized for sharing rather than for whatever viewport the buyer
had. A test decodes the QR back out of the rendered PNG with `jsQR` to prove a
door scanner can read the picture a buyer forwards.

**Share** degrades in three steps, because no one API covers this:
`navigator.share` with the file (iOS/Android — the image lands in the chat) →
`navigator.share` with a link (browsers that expose sharing but refuse files) →
a `wa.me` link (desktop). The last one cannot carry the image: WhatsApp's URL
scheme is text-only. That is why Download sits beside Share rather than in a
menu — attaching the saved picture is the desktop workaround.

> **Do not move the image render into the click handler.** `navigator.share()`
> needs transient user activation, and iOS Safari requires the call to happen
> in the same task as the tap — an intervening `await` gets you
> `NotAllowedError` and no share sheet. The PNG is therefore rendered on mount
> during idle time and both buttons stay disabled until it exists, so the
> handlers can call `share()` and `click()` synchronously.
>
> Chromium will not catch a regression here: it keeps activation live for 5s
> across awaits, so the broken pattern passes locally and fails only on real
> iPhones. Measured ready ~1.2–1.6s after navigation on a 4×-throttled phone.

**Celebration** fires only on `?celebrate=1`, set by the payment-result page and
the free-ticket path. A revisit or refresh gets a calm page. Confetti is CSS on
`transform`/`opacity` only, unmounts after 3.4s, and is hidden under
`prefers-reduced-motion`.

## Admin (`/admin`)

Two pages against the admin API (Backend-v2 PR #21): **metrics** and
**status**. Sign in at `/admin/login` with an ADMIN account.

Buyer pages live under the `(site)` route group so `/admin` can opt out of the
storefront chrome entirely.

**The client-side role check is a courtesy, not a gate.** Every `/admin/*`
route on the API is `@Roles(UserRole.ADMIN)` — a different gate from the
organizer pages, which use `@Roles(ORGANIZER, ADMIN)` — and answers 403 to
anything else. Admin signs in on the same httpOnly session as everyone else
(the old localStorage session is gone), and its reads go through the
`/api/backend` forwarder. The UI's role check exists so an ORGANIZER who signs
in gets one clear sentence instead of a wall of failed requests; the API's
403 is the gate.

### Rules the UI has to keep

**A rate is `null`, never `0`, when there was nothing to divide.** `0%` says
the business earns nothing; `null` says nothing sold. Nulls render as an em
dash **with a reason beside them** (`takeRate`, `averageOrderValue`,
`attendanceRate`, `failureRate`) — never as a number.

**`paidAwaitingMint` is the alarm; `abandonedCheckouts` is not.** The first is
a buyer out of pocket with no ticket and is always Critical in the incident
list. The second is a normal property of any funnel and appears only on the
metrics page beside conversion. They are never summed and never styled alike —
listing abandonment as an incident would train everyone to ignore the panel.

**`kyc.verified` / `kyc.pending` ignore the date range** and are labelled
"not this date range", because they are current standings rather than flow.

**`events.byStatus` is a partial record.** A status with no rows is absent, not
zero — the UI iterates what is there rather than asserting a fixed set.

### What the API cannot tell you

- **No uptime or latency.** An API cannot report its own availability — a
  request that never arrived is one the server cannot count. Needs Render
  metrics or an external prober; nothing on the page claims it.
- **No uptime bars, and no incident history.** A statuspage.io-style 90-day
  strip comes from an *external prober* sampling from outside. Drawing one from
  what a browser happened to observe would produce a figure that looks
  authoritative and means "whenever someone had the tab open". The page says so
  in place of the strip rather than omitting it silently.
- **`/api/health` goes blind when it fails.** Healthy, it is rich: per-chain
  block heights, per-queue depths. Unhealthy, it returns a bare 503 —
  `HttpExceptionFilter` is registered globally in `main.ts` and rewrites every
  error to `{ statusCode, message, timestamp, path }`, discarding Terminus's
  `info`/`error`/`details`. So the status page is **ops-first**: `/admin/ops`
  carries the diagnosis and health is a coarse banner that says plainly it does
  not know which check failed. A one-line backend fix (exclude `/health` from
  the filter) would make it specific.
- **No user management.** There is no `/admin/users` and no role-change
  endpoint anywhere in the backend — `/admin/users` 404s on live, and
  `AdminController` is read-only by design. Any user-admin UI needs backend
  work first.

### The status page

An incident list first (`Needs attention`), then dependency cards, then the
90-day uptime strips, then the raw panels. During an incident the counts are
what you work from, so they stay.

**The uptime strips are honest about what they are.** A statuspage.io bar is
drawn by an *external prober* sampling every minute whether or not anyone is
looking. CrowdPass has none, so `lib/uptime-history.ts` records what this
browser observes while the page is open, and:

- a day nobody watched is **grey**, never green — silence is not evidence of
  health, and colouring it green would be the whole lie;
- the percentage is over **observed days only** and is labelled as such, so it
  cannot be misread as "100% uptime over 90 days";
- each day keeps the **worst** level seen, matching how statuspage treats a
  partial-day incident.

Component levels come from `lib/status-model.ts` — one rule per component,
each tied to a signal the API really reports, with a **Status Unknown** level
for when `/api/health` 503s and the filter has already discarded which
indicator failed. Nothing is green by default.

Swapping the local store for a `status_samples` table read through one endpoint
turns these into real uptime bars; `UptimeStrip` itself would not change.

### The chart

One series, one axis. The daily endpoint returns `gmv` **and**
`transactions`, and plotting both would be a dual-axis chart — two scales whose
alignment is arbitrary, inventing a correlation the data does not contain.
Transactions ride in the tooltip instead. Provider amounts use **one hue for
every bar**: nominal categories carrying one measure, so a per-provider hue
would burn the only free channel restating bar length.

## The crypto lane

`POST /tickets/purchase` with `paymentProvider: 'CRYPTO'` returns
`checkoutUrl: null` and one of two answers. **`paidFromBalance: true`** means
the buyer's custodial USDC already covered it; it is settled, so the buyer goes
straight to the ticket and never sees a deposit screen. Otherwise a **`crypto`**
object says where to send what, and `/checkout/crypto/[reference]` shows it.

**The deposit address is never read from the URL.** It is saved with the
pending purchase in this browser's storage. A deposit page that took its
address from a query string would let anyone send a buyer a link carrying a
real reference and *their* address. Opened in another browser, the page says
where to look and can still check the payment.

**The amount is shown to full USDC precision**, because a buyer who under-sends
by rounding does not get a ticket. **Expiry is not failure**: the page keeps
checking for a while after the countdown, in case the deposit was already in
flight. Settlement arrives by Circle webhook, and like everything async on this
backend, the client polls (every 12s here); there is no WebSocket or SSE
anywhere.

**Wallets are custodial and read-only here.** The profile's wallet card reads
USDC balances with a public `eth_call` (`balanceOf`), server-side, so browser
CORS on RPCs never comes into it. There is no signing, no connect-wallet, and
no user-facing wallet endpoint on the backend. A wallet still being created
reads "Setting up", and an unreadable balance is a dash, never 0.00.

## The door scanner

`getUserMedia` works everywhere, but **`BarcodeDetector` does not exist on iOS
Safari**, the most likely phone at a Nigerian door. So `lib/qr-detector.ts`
uses two tiers: the native detector where it reads QR, and the
`barcode-detector` ponyfill (zxing-wasm) everywhere else. The ~1 MB WASM is
copied into `public/zxing/<version>/` by `scripts/copy-zxing-wasm.mjs` before
`dev` and `build`, so a queue on mobile data never waits on a third-party CDN.
**The camera and the clipboard need HTTPS**, so test the door on a preview
deploy, not `localhost` on a phone.

**The scanned string goes to `POST /tickets/resolve-qr` untouched.** Mobile
tickets encode the bare reference; web and email tickets encode a signed
`htv1.<payload>.<sig>` token. That endpoint exists to bridge the two, and a
scanner that understands only one format rejects half the queue.

**Check-in does not need the QR at all.** Verify and check-in look a ticket up
by reference, and a buyer whose mint is still pending has a reference and no
QR. Manual entry and the roster cover every device and every degraded state.
They ship with the scanner, not after it.

## Organizer money

**Covers upload through `POST /api/uploads/cover`.** The backend has no upload
endpoint (`coverImage` is just a URL), so a route handler holds a server-only
`PINATA_JWT`. Mobile ships its Pinata key in the app bundle; on the web that
key would sit in JavaScript anyone can read, so it never gets a
`NEXT_PUBLIC_` prefix.

**`shareBps` is basis points of the organizer's cut, not of gross.** A
revenue partner set at 20% of a host who keeps 95% of each sale receives 19%
of the sale. Every share is shown both ways ("20% of your cut · 19% of each
sale"), because a partner told "20%" who sees 19% thinks they were shorted.

**A published event's only editable field is ticket price**, and changing it
rewrites the on-chain fee for new sales only. **A payout request is
asynchronous**: the UI says "requested", never "paid", until `GET
/organizer/payouts` says otherwise. **Cancelling auto-enqueues refunds** for
USDC tickets on refundable events, and there is no un-cancel.

**A `DEV_`-prefixed subaccount means "not connected".** A dev subaccount that
reads as connected is how an organizer publishes an event that cannot take
money.

**A rate is `null`, never `0`, when nothing was divided.** On every organizer
and admin surface, an empty period renders as an em dash with its reason,
never as "0%".

## Loading states

Three tiers, chosen by how long the wait is and how much is known about what
is coming:

**Route skeletons** (`loading.tsx` in each dynamic segment) paint the page's
real structure immediately instead of a blank screen while the server fetches.
They mirror the finished layout at every breakpoint — a skeleton that does not
match what arrives is worse than none, because the page visibly reflows under
the reader. Uses a sweep, not a pulse: a pulsing block reads as "broken", a
sweep reads as "coming".

**`BrandSpinner`** for section-level waits with no known shape — settling a
payment, minting a ticket. A direct port of
`v2-mobile/src/components/BrandSpinner.js` down to the timings (300ms lift,
520ms settle, 130ms stagger, 1470ms cycle), so a wait looks the same on both
surfaces. Nothing spins: the six blocks of the mark breathe in sequence around
a fixed door, so a wait reads as the brand rather than as the platform. The
door holds still — it is the part that reads as CrowdPass, and pulsing it too
turns the mark into noise.

**The plain `Spinner`** stays inside buttons. The mark at 18px is mush.

The mark geometry in `BrandMark.tsx` is traced vector, ported verbatim from
mobile's `AnimatedMark.js` — the delivered logo is a flat PNG with no vector
source (design open issue #12), so the pieces had to be traced to move
independently. **The two files must not drift**, or the same brand animates
differently on web and mobile. Verified by overlaying the vector on
`logo-mark.png`; alignment is sub-pixel.

Both the pulse and the sweep collapse under `prefers-reduced-motion` — to a
still, whole mark and a flat block. Someone who asked the OS for less motion is
not served by a slower version of the same animation.

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
