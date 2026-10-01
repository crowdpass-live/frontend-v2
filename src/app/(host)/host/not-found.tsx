import Link from "next/link";
import { Mascot } from "@/components/Mascot";
import { Container } from "@/components/ui";

/**
 * Inside the host shell, so an unknown event id does not fall through to the
 * root not-found page — which wears the storefront header and footer and
 * would nest them inside this surface's chrome.
 */
export default function HostNotFound() {
  return (
    <Container className="flex flex-col items-center gap-4 py-20 text-center">
      <Mascot pose="error" height={120} />
      <h1 className="text-title font-bold text-text">Event not found</h1>
      <p className="text-body text-text-dim">
        There&apos;s no event at this address. It may have been a mistyped or
        old link.
      </p>
      <Link href="/host" className="text-body font-bold text-accent hover:text-accent-hi">
        Back to your dashboard
      </Link>
    </Container>
  );
}
