import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * Chrome for the sign-in pages: the logo home and nothing else.
 *
 * Its own group rather than `(site)` because the storefront header carries
 * the account menu, and a "Sign in" button on the sign-in page is noise. The
 * storefront stays one click away through the logo.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 pt-6 sm:px-8">
        <Link href="/" aria-label="CrowdPass home" className="inline-flex">
          <Logo variant="full" height={24} priority />
        </Link>
      </header>
      <main className="grid flex-1 place-items-center px-5 py-12 sm:px-6">
        {children}
      </main>
    </div>
  );
}
