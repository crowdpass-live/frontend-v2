import type { Metadata } from "next";
import { Suspense } from "react";
import { CallbackClient } from "./CallbackClient";
import { Container } from "@/components/ui";
import { BrandSpinner } from "@/components/BrandSpinner";

export const metadata: Metadata = {
  title: "Confirming payment",
  robots: { index: false, follow: false },
};

/**
 * Where the payment gateway sends the buyer after checkout.
 *
 * Providers disagree on the query parameter name — Paystack sends `reference`
 * *and* `trxref`, Monnify sends `paymentReference` — so all three are read
 * client-side, with the remembered pending purchase as a last resort.
 */
export default function CheckoutCallbackPage() {
  return (
    <main className="flex flex-1 flex-col justify-center py-16 lg:py-24">
      <Suspense
        fallback={
          <Container className="flex flex-col items-center gap-4 text-center">
            <BrandSpinner width={88} label="Confirming your payment" />
            <p className="text-body text-text-dim">Confirming your payment…</p>
          </Container>
        }
      >
        <CallbackClient />
      </Suspense>
    </main>
  );
}
