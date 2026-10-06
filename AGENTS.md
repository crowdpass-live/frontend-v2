<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CrowdPass Web: project rules

Read `README.md` (why things are the way they are) and `CONTRIBUTING.md`
(where things go) before changing code. The rules most easily broken:

- **Branches:** work off `develop`, open PRs against `develop`. `main` is
  production; nothing merges into it directly.
- **Session:** the JWT is an httpOnly cookie. Server code uses `serverFetch()`;
  client code uses `apiFetch(path, { auth: true })` via `/api/backend`. Never
  put a token in client JavaScript. Read `role` from `/auth/me`, never the
  JWT. There is no refresh token: a 401 means sign in again.
- **The door** is gated on `my-checkin-events` returning rows, never on
  `isOrganizer`. Delegates are plain BUYERs.
- **Backend contract:** `forbidNonWhitelisted`, so send exactly the DTO's
  fields and omit empty optionals. Surface `errors[]` text, which is written
  for users. BigInt arrives as a string; never `Number()` it. Everything
  async is poll-only. Never retry a purchase.
- **Money:** `shareBps` is of the organizer's cut, not gross. Show both. A
  rate with nothing to divide is `null` (em dash + reason), never 0.
- **Secrets:** server-only env vars (`PINATA_JWT`, `RPC_URL_*`,
  `TICKET_CONTRACT_*`) never get a `NEXT_PUBLIC_` prefix.
- **Design:** tokens only, no hex. Black text on orange. `Button` carries no
  width; every call site sets its own. Status pills are tinted, never solid.
  One element in two positions, never two elements. Only the chip strip may
  overflow-x (check with `/dev/responsive-audit`). Respect
  `prefers-reduced-motion`.
- **Checks before a PR:** `pnpm lint && pnpm exec tsc --noEmit && pnpm build`.
