import type { ReactNode } from "react";
import Link from "next/link";
import { Mascot, type MascotPose } from "@/components/Mascot";

/**
 * The shared frame for the account pages — sign in, sign up, verify,
 * forgot and reset password — so they read as one flow: a two-line
 * headline (mobile's `Headline`), one sentence under it, the form, and the
 * links that move between them.
 */
export function AuthPanel({
  line1,
  line2,
  sub,
  pose = "waving",
  children,
  footer,
}: {
  line1: string;
  line2: string;
  sub: ReactNode;
  pose?: MascotPose;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display font-bold text-text">
            {line1}
            <br />
            {line2}
          </h1>
          <p className="mt-2 text-body text-text-dim">{sub}</p>
        </div>
        <Mascot pose={pose} height={72} />
      </div>
      {children}
      {footer ? <div className="flex flex-col gap-2 text-label text-text-dim">{footer}</div> : null}
    </div>
  );
}

/** A footer link in the auth flow, with a full-size tap target. */
export function AuthLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-10 w-fit items-center font-bold text-accent hover:text-accent-hi">
      {children}
    </Link>
  );
}
