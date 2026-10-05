import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { fetchBankHistory, fetchBanks, settle } from "@/lib/organizer";
import { isRealSubaccount } from "@/lib/payout-setup";
import { NG_BANKS } from "@/lib/banks";
import { PayoutAccount } from "@/components/host/PayoutAccount";
import { Container } from "@/components/ui";

export const metadata: Metadata = { title: "Payout account" };

/**
 * Where card and bank-transfer sales settle (#35). The state is read from
 * `/auth/me`'s organizer profile; the bank list and the change trail are
 * best-effort extras — neither failing should take the page down.
 */
export default async function PayoutAccountPage() {
  const user = await requireUser();
  const p = user.organizerProfile;
  if (!p) return <OrganizersOnly />;

  const connected = isRealSubaccount(p.paystackSubaccountCode) || isRealSubaccount(p.monnifySubAccountCode);
  const verified = p.kycStatus === "VERIFIED";
  const [banks, history] = await Promise.all([
    verified ? settle(fetchBanks()) : null,
    connected ? settle(fetchBankHistory()) : null,
  ]);

  return (
    <Container className="flex flex-col gap-6 py-10">
      <header>
        <Link href="/host" className="text-label text-text-dim hover:text-text">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-title font-bold text-text">Payout account</h1>
        <p className="mt-1 text-body text-text-dim">
          The bank account your card and bank-transfer sales settle to. Your share
          goes straight there — crypto sales stay in your CrowdPass wallet.
        </p>
      </header>
      <PayoutAccount
        profile={{
          kycStatus: p.kycStatus,
          bankName: p.bankName,
          bankCode: p.bankCode,
          accountNumber: p.accountNumber,
          accountName: p.accountName,
          bankVerified: p.bankVerified,
          paystackSubaccountCode: p.paystackSubaccountCode,
          monnifySubAccountCode: p.monnifySubAccountCode,
        }}
        banks={banks?.ok && banks.value.length ? banks.value : NG_BANKS}
        history={history?.ok ? history.value.data : []}
      />
    </Container>
  );
}

function OrganizersOnly() {
  return (
    <Container className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-title font-bold text-text">Organizer accounts only</h1>
      <p className="text-body text-text-dim">
        A payout account belongs to an organizer.{" "}
        <Link href="/host" className="font-bold text-accent hover:text-accent-hi">
          Back to the dashboard
        </Link>
        .
      </p>
    </Container>
  );
}
