import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * Buyer-facing chrome.
 *
 * A route group rather than the root layout, so `/admin` can opt out
 * entirely — an admin console wearing the storefront header would be both
 * confusing and a small information leak about the tool's existence.
 */
export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
