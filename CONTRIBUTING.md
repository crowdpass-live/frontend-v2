# Contributing to CrowdPass Web

Read this once before picking up an issue. The [README](README.md) explains
*why* the purchase path works the way it does; this file tells you where new
code goes and which rules will bite if you don't know them. The work is
tracked in the web-parity epic (#63) and its phase epics (#54–#62). Each
sub-issue names the mobile screen it ports, the endpoints it calls and what
"done" means, so you should not need to open `v2-mobile` to start.

## Getting running

```bash
pnpm install
cp .env.example .env.local   # points at STAGING — keep it that way
pnpm dev                     # http://localhost:3000
```

Before every push, run what CI runs:

```bash
pnpm lint && pnpm exec tsc --noEmit && pnpm build
```

> **`http://localhost:3000` must be in the backend's `CORS_ORIGINS`.** If it
> isn't, checkout renders with no payment methods and nothing errors — the
> browser simply blocks `GET /payments/methods`. `CORS_ORIGINS` is also the
> `returnUrl` allowlist, so the gateway won't return you here either.

This is Next.js 16, which has breaking changes from what you may know (for
example, middleware is now `src/proxy.ts`). Read the relevant guide in
`node_modules/next/dist/docs/` before writing framework code.

## Branches and pull requests

`main` is production. Nothing merges straight into it.

```
feature branch (off develop) → PR into develop → (maintainers promote) → main
```

Branch off `origin/develop`, open your PR against `develop`, and put
`Closes #N` in the description for every issue it finishes.

## Where things go — route groups

Route groups (the bracketed folders) organise code and choose a layout. They
never appear in the URL.

| Group | URLs | Who | Gate |
|---|---|---|---|
| `(site)` | `/`, `/events/*`, checkout, `/checkout/callback`, `/tickets/[reference]` | anyone | none — guest checkout is the shopfront |
| `(auth)` | `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/auth/reset-password` | signed out | none |
| `(account)` | `/account/*` | any signed-in user | session (proxy) |
| `(host)` | `/host/*` | organizers | session + `isOrganizer` from `/auth/me`, checked in the layout |
| `(door)` | `/door/*` | anyone with a door to work | session + `GET /organizer/my-checkin-events` returning rows |
| `admin` | `/admin/*` | admins | session; sign-in at `/admin/login` |

**The door rule is the most-missed detail in the codebase.** Check-in
delegates are ordinary `BUYER` accounts holding an `EventTicketAdmin` grant.
There is no staff role. Gate `(door)` on `my-checkin-events`, **never** on
`isOrganizer` — that locks out exactly the people the door exists for.

A layout gate is UX, not security: a page renders in parallel with its
layout. The API checks the bearer and ownership on every request, and that is
the real boundary.

## The session

- The JWT lives in an **httpOnly cookie** (`cp_session`). No client JavaScript
  can read it and it never ships in a bundle. Sign-in happens server-side in
  `POST /api/session`, so the token goes API → handler → cookie.
- **Server-first.** Authenticated pages fetch in server components with
  `serverFetch()` (`src/lib/api-server.ts`). Read the user with
  `getCurrentUser()` / `requireUser()` (`src/lib/session.ts`).
- **Client components** call `apiFetch(path, { auth: true })`, which goes
  through `/api/backend/*`. That handler swaps the cookie for a bearer header.
  Never call it directly.
- **Read `role` from `/auth/me`, never from the token.** The token's copy is
  stamped at login. The API re-reads the user row on every request, so a buyer
  who becomes a host is a host immediately.
- **No refresh token, no logout endpoint.** The JWT lives 24h. A 401 always
  means "sign in again", and every 401 is routed through one place, which
  clears the cookie and comes back via `?next=`.
- `src/proxy.ts` only checks that a live cookie exists on `/account`,
  `/host`, `/door` and `/admin`. Role checks belong in the group layouts.

## Backend contract gotchas

- **`ValidationPipe({ forbidNonWhitelisted: true })`** — one stray field 400s
  the whole request. Send exactly the DTO's fields, and omit empty optionals
  rather than sending `""` or `null`.
- **Errors are not enveloped.** The text in `errors[]` / `message` is written
  for the user ("Only 3 ticket(s) remaining"). Show it; `ApiError` already
  extracts it. A generic "Something went wrong" makes people retry what can
  never succeed.
- **`BigInt` arrives as a string** (`tokenId`, `onChainTicketId`). Don't
  `Number()` it.
- **The attendee CSV export skips the response envelope** (`@SkipTransform`).
  A generic "unwrap `.data`" fetch corrupts it.
- **Everything async is poll-only.** There are no WebSockets and no SSE.
  Payments, mints, KYC and payouts all settle in the background.
- **`PENDING` is not a failure.** Bank transfer and USSD can confirm minutes
  later.
- **`shareBps` is basis points of the organizer's cut, not of gross.**
- **Never retry a purchase**, except the one `returnUrl` feature-detect in
  `purchaseTicket()`.
- **Never point a local build at the production API.** It sells real tickets.

## Design rules that bite

Tokens live in `src/app/globals.css`, ported 1:1 from mobile's `theme.js`.

- **Nothing hardcodes a hex.** Use tokens (`bg-surface`, `text-text-dim`,
  `text-accent`, …).
- **Text on an orange button is BLACK** (`text-ink`), not white.
- **`Button` / `ButtonLink` carry no width.** Every call site states its own
  (`w-full`, `w-full sm:w-auto`). A width in the base would silently beat
  your override, depending on stylesheet order.
- **Status pills are tinted fills with coloured text** (`Badge`:
  `bg-ok/15 text-ok`), never solid. A *control* such as `Chip` is solid when
  active.
- **One element, two positions — never two elements.** Responsive layouts
  move one node with classes. Rendering it twice puts two submit buttons in
  one form.
- **Only the chip strip may overflow-x**, at any width from 320px to 1728px.
  Tables scroll inside their own container.
- **Two container widths:** `Container size="reading"` (560px) for forms and
  tickets, and `size="page"` (1152px) for surfaces with parallel content.
- **Focus rings use the accent.** Browser blue is invisible on `#08090D`.
- **Respect `prefers-reduced-motion`**: a still mark, not a slower animation.
- **Loading tiers:** a matching `loading.tsx` skeleton for route data,
  `BrandSpinner` for waits with no known shape (settling, minting, polling),
  and the plain `Spinner` inside buttons only.

## The shared primitives

Reach for these before writing your own:

| Need | Use |
|---|---|
| Button, card, pill, inline error, layout width | `ui.tsx` — `Button`, `ButtonLink`, `Card`, `Badge`, `ErrorNote`, `Container` |
| Text input (accounts/organizer) | `TextField` (icon, password reveal) |
| Text input (guest forms) | `Field` in `ui.tsx` |
| Dropdown | `Select` (native-backed) |
| Filter/category pill | `Chip` |
| Quantity | `Stepper` |
| Date + time | `DateTimeField` + `toLocalInputValue` / `fromLocalInputValue` |
| Modal panel | `Sheet` (bottom sheet on phones) |
| Irreversible yes/no | `ConfirmDialog` |
| "Done", no action needed | `useToast()` |
| Multi-step work in flight | `BusyOverlay` |
| Icons | `icons.tsx` (all inherit `currentColor`) |

There's no component library (no shadcn, Radix or CVA). `cx()` is a one-liner
and stays that way.
