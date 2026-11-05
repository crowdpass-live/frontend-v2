"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { saveReferral } from "@/lib/referral";
import { BrandSpinner } from "@/components/BrandSpinner";
import { Container } from "@/components/ui";

interface ResolvedReferral {
  code: string;
  label: string;
  eventId: string;
  eventSlug: string;
  expiresAt: string | null;
}

/**
 * `GET /referrals/:code` counts a click and says which event the link is
 * for. The code is remembered against that event (last click wins) and the
 * buyer lands on the event page.
 *
 * Any failure — unknown, disabled or expired link, event off sale, rate
 * limit, no signal — goes to the home page without an error: the buyer did
 * nothing wrong, and an error page would cost the sale.
 */
export function ReferralRedirect({ code }: { code: string }) {
  const router = useRouter();
  // Each call counts a click and the route is throttled; resolve once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    apiFetch<ResolvedReferral>(`/referrals/${encodeURIComponent(code)}`, { cache: "no-store", timeout: 30_000 })
      .then((r) => {
        saveReferral(r.eventId, { code: r.code, expiresAt: r.expiresAt });
        router.replace(`/events/${encodeURIComponent(r.eventSlug)}`);
      })
      .catch(() => router.replace("/"));
  }, [code, router]);

  return (
    <main className="flex flex-1 flex-col justify-center py-24">
      <Container className="flex flex-col items-center gap-4 text-center">
        <BrandSpinner width={88} label="Opening the event" />
        <p className="text-body text-text-dim">Opening the event…</p>
      </Container>
    </main>
  );
}
