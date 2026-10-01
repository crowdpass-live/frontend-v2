"use client";

import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui";

/**
 * "Sign in", returning to the page it was clicked on. Client-side only
 * because a server layout cannot see its own path.
 */
export function SignInLink() {
  const pathname = usePathname();
  const href =
    pathname && pathname !== "/" && pathname !== "/login"
      ? `/login?next=${encodeURIComponent(pathname)}`
      : "/login";
  return (
    <ButtonLink href={href} variant="secondary" size="sm" className="whitespace-nowrap">
      Sign in
    </ButtonLink>
  );
}
