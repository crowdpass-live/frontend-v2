import "server-only";

import { fetchUsdcBalance } from "./onchain";
import type { WalletView } from "@/components/account/WalletCard";
import type { ApiWallet } from "@/types/api";

/**
 * The signed-in user's wallets with their USDC balances (#26), primary first.
 *
 * `wallets[]` comes from `GET /auth/me`; balances are read here, in
 * parallel, each under its own timeout so one slow RPC can't hold the
 * others. Circle provisioning is async and poll-only: a wallet with no
 * address yet is "provisioning", not a zero balance.
 */
export async function walletViews(wallets: ApiWallet[]): Promise<WalletView[]> {
  const ordered = [...wallets].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  return Promise.all(
    ordered.map(async (w): Promise<WalletView> => {
      const failed = !!w.creationError || /fail/i.test(w.creationStatus ?? "");
      const state = w.address ? "ready" : failed ? "failed" : "provisioning";
      return {
        id: w.id,
        chain: w.chain,
        address: w.address,
        isPrimary: w.isPrimary,
        state,
        balance: w.address ? await fetchUsdcBalance(w.chain, w.address) : null,
      };
    }),
  );
}
