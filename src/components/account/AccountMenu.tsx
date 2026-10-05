import { Suspense } from "react";
import { getCurrentUser, getDoorEvents, getSession } from "@/lib/session";
import { AccountMenuButton, type AccountLink } from "./AccountMenuButton";
import { SignInLink } from "./SignInLink";

/**
 * The header's account slot: "Sign in" when signed out, the account menu
 * when signed in.
 *
 * Whether someone is signed in comes from the cookie alone (no network), so
 * the header never flashes a signed-out state at a signed-in user. What goes
 * IN the menu needs `/auth/me` and `my-checkin-events`; that part is async
 * and is meant to sit behind a `Suspense` boundary, so a cold API never
 * holds a public page hostage — see `AccountSlot`.
 */
export async function AccountMenu() {
  const [user, doors] = await Promise.all([
    // `undefined` = could not ask. This sits in the storefront header, where
    // nothing above it catches an error — a cold API must not take the event
    // page down with it.
    getCurrentUser().catch(() => undefined),
    getDoorEvents(),
  ]);
  // Cookie present but rejected: offer sign-in, which replaces it.
  if (user === null) return <SignInLink />;
  // Signed in, details unknown: still let them get to their surfaces and out.
  if (user === undefined) {
    return (
      <AccountMenuButton
        name="Your account"
        email=""
        links={[
          { href: "/host", label: "Host dashboard" },
          { href: "/account/tickets", label: "My tickets" },
          { href: "/account", label: "Account" },
        ]}
      />
    );
  }

  const links: AccountLink[] = [];
  // `isOrganizer` gates host; the door is gated on delegation rows, never on
  // the role — a delegate is a plain BUYER and must still see it.
  if (user.isOrganizer) links.push({ href: "/host", label: "Host dashboard" });
  // Organizers may scan their own events without a grant, so they always
  // have a door; delegates only when a grant exists.
  if (user.isOrganizer || doors?.length) links.push({ href: "/door", label: "At the door" });
  links.push({ href: "/account/tickets", label: "My tickets" });
  links.push({ href: "/account", label: "Account" });
  if (!user.isOrganizer) links.push({ href: "/host", label: "Host an event" });

  return <AccountMenuButton name={user.name} email={user.email} links={links} />;
}

/** A placeholder the same size as the avatar button, while the menu loads. */
export function AccountMenuFallback() {
  return (
    <span
      aria-hidden
      className="block size-8 animate-pulse rounded-full bg-surface-strong"
    />
  );
}

/**
 * What headers render: the cookie check up front (cheap, so signed-out
 * visitors see "Sign in" in the first byte), then the menu streamed in.
 */
export async function AccountSlot() {
  if (!(await getSession())) return <SignInLink />;
  return (
    <Suspense fallback={<AccountMenuFallback />}>
      <AccountMenu />
    </Suspense>
  );
}
