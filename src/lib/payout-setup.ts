import { isProvisionalName } from "./names";
import type { SessionUser } from "./normalize";

/**
 * Where a host stands on the road to card and bank-transfer sales: a real
 * name, then identity, then a bank. Crypto (USDC) events need none of it.
 *
 * Read from `/auth/me` (the session user), so the dashboard can show it with
 * no extra request. The verify page reads `GET /organizer/kyc` itself.
 */
export interface PayoutSetup {
  /** The profile name is the one the ID will be matched against. */
  name: "done" | "todo";
  identity: "done" | "todo" | "blocked";
  bank: "done" | "todo";
  /** Every step done: card and transfer sales are open. */
  complete: boolean;
}

/**
 * A `DEV_` subaccount is a placeholder from a dev environment, not a payment
 * lane. Treating it as connected is how an event goes live unable to take
 * money — mobile's `isMockSubaccount()`.
 */
function isRealSubaccount(code: string | null | undefined): boolean {
  return !!code && !code.startsWith("DEV_");
}

export function payoutSetup(user: SessionUser): PayoutSetup {
  const p = user.organizerProfile;
  const verified = p?.kycStatus === "VERIFIED";
  const setup: PayoutSetup = {
    // Once verified the name is locked to the ID, so it is done either way.
    name: verified || !isProvisionalName(user) ? "done" : "todo",
    identity: verified ? "done" : p?.kycStatus === "REJECTED" ? "blocked" : "todo",
    bank:
      isRealSubaccount(p?.paystackSubaccountCode) || isRealSubaccount(p?.monnifySubAccountCode)
        ? "done"
        : "todo",
    complete: false,
  };
  setup.complete = setup.name === "done" && setup.identity === "done" && setup.bank === "done";
  return setup;
}
