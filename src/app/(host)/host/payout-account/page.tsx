import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { fetchBankHistory, fetchBanks, settle } from "@/lib/organizer";
import { isRealSubaccount } from "@/lib/payout-setup";
import { NG_BANKS } from "@/lib/banks";
import { PayoutAccount } from "@/components/host/PayoutAccount";
import { AsideCard, SplitPage } from "@/components/app/SplitPage";
import { BankIcon } from "@/components/icons";
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
    <SplitPage
      header={
        <header>
          <Link href="/host" className="text-label text-text-dim hover:text-text">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-title font-bold text-text">Payout account</h1>
          <p className="mt-1 max-w-2xl text-body text-text-dim">
            The bank account your card and bank-transfer sales settle to. Your share
            goes straight there — crypto sales stay in your CrowdPass wallet.
          </p>
        </header>
      }
      aside={
        <>
          <AsideCard title="How payouts work" icon={<BankIcon width={16} height={16} />}>
            <p>
              When a buyer pays by card or transfer, your share is split off at the
              payment provider and settles to this account — CrowdPass never holds it.
            </p>
            <p>
              USDC sales are different: they sit in on-chain escrow and you withdraw
              them from{" "}
              <Link href="/host/payouts" className="font-bold text-accent hover:text-accent-hi">
                Payouts
              </Link>
              .
            </p>
          </AsideCard>
          <AsideCard title="Paystack or Monnify?">
            <p>Both pay the same account. Paystack also takes USSD; connecting both gives buyers the most ways to pay.</p>
          </AsideCard>
          <AsideCard title="Changing banks">
            <p>
              You can switch accounts any time, except while a payout is processing.
              We check the new account&apos;s name with the bank first.
            </p>
          </AsideCard>
        </>
      }
    >
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
    </SplitPage>
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
