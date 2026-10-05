import type { Metadata } from "next";
import { CryptoDepositClient } from "./CryptoDepositClient";

export const metadata: Metadata = {
  title: "Pay with USDC",
  // A deposit page is one buyer's order; keep it out of indexes and
  // referrers like the ticket page.
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

/**
 * The USDC deposit screen (#30). Ports `CryptoPaymentScreen.js`.
 *
 * `reference` is the transaction reference from the purchase. Everything
 * else — address, amount, chain, expiry — is read from the purchase this
 * browser started (see `PendingPurchase.crypto`), never from the URL.
 */
export default async function CryptoDepositPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  return (
    <main className="flex flex-1 flex-col py-8 lg:py-16">
      <CryptoDepositClient reference={decodeURIComponent(reference)} />
    </main>
  );
}
