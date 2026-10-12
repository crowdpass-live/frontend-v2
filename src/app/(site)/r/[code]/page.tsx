import type { Metadata } from "next";
import { ReferralRedirect } from "./ReferralRedirect";

export const metadata: Metadata = {
  title: "Opening event",
  robots: { index: false, follow: false },
};

/**
 * A referral link, `/r/<code>` (#48) — printed on flyers and shared by
 * influencers and vendors. Resolved in the browser because the click has to
 * be remembered there (`lib/referral`).
 */
export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ReferralRedirect code={code} />;
}
