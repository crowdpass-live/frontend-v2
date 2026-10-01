"use client";

import { Mascot } from "@/components/Mascot";
import { Button } from "@/components/ui";

/**
 * The `error.tsx` body for the signed-in surfaces.
 *
 * Almost always a cold or unreachable API: a rejected session never lands
 * here (it redirects to sign-in), so this must not say "signed out" — and
 * offering a retry is honest, because the next attempt usually works.
 */
export function RouteError({ retry }: { retry: () => void }) {
  return (
    <div className="grid place-items-center px-6 py-24">
      <div className="flex max-w-sm flex-col items-center gap-5 text-center">
        <Mascot pose="error" height={120} />
        <h1 className="text-title font-bold text-text">
          We couldn&apos;t reach CrowdPass
        </h1>
        <p className="text-body text-text-dim">
          The connection dropped or the server is waking up. Your session is
          fine — try again in a moment.
        </p>
        <Button type="button" onClick={retry} className="w-full sm:w-auto">
          Try again
        </Button>
      </div>
    </div>
  );
}
