# CrowdPass Web

The buyer-facing web surface for CrowdPass. Scope is the guest purchase path:
a shared link opens an event, and someone with no account walks out with a
ticket.

```
/events/[slug]            event detail        server-rendered, OG-scrapeable
/events/[slug]/checkout   guest checkout      tier · quantity · details · rail
/checkout/callback        payment return      polls settlement → 3 states
/tickets/[reference]      the ticket + QR     public, no account needed
```

Browse/discover, auth, and the organizer dashboard are **not** in this build.
`/` is a placeholder so those routes have a parent.

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

- Set `NEXT_PUBLIC_API_URL` to the backend's `/api` origin.
- Add this site's origin to the backend's **`CORS_ORIGINS`**. Without it the
  browser blocks every client-side call and checkout silently shows no payment
  options — the page looks fine and simply cannot sell anything.

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
