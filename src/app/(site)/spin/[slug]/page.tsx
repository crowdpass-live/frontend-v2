import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiError, apiFetch } from "@/lib/api";
import { getCurrentUser, getSession } from "@/lib/session";
import type { SpinCampaign } from "@/lib/spin-wheel";
import { SpinPlay } from "@/components/spin/SpinPlay";
import { Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Spin the wheel",
  robots: { index: false },
};

/**
 * `/spin/<event-slug>`: the page behind the QR code at an event's CrowdPass
 * booth. Signed out, it sells the sign-up; signed in, it is the wheel.
 *
 * Fetched with the session when there is one, so the caller's own spin comes
 * back with the campaign. A stale token is not an error here: the page just
 * renders as signed out, and sign-up/login bring them back via `?next=`.
 */
async function getCampaign(slug: string, token: string | null): Promise<SpinCampaign> {
  const path = `/spin-wheel/events/${encodeURIComponent(slug)}`;
  try {
    return await apiFetch<SpinCampaign>(path, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    if (err instanceof ApiError && err.status === 401 && token) {
      return getCampaign(slug, null);
    }
    throw err;
  }
}

export default async function SpinPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  const [campaign, user] = await Promise.all([
    getCampaign(slug, session?.accessToken ?? null),
    session ? getCurrentUser() : Promise.resolve(null),
  ]);

  return (
    <Container className="flex flex-col gap-6 py-8 sm:py-12">
      <div className="flex flex-col gap-1 text-center">
        <p className="text-label font-medium text-accent">{campaign.event.name}</p>
        <h1 className="text-title font-bold text-text">Spin to win</h1>
        <p className="text-body text-text-dim">
          {campaign.prizes.map((p) => p.label).join(" · ")}
        </p>
      </div>
      <SpinPlay
        campaign={campaign}
        here={`/spin/${slug}`}
        user={campaign.me && user ? { email: user.email, phone: user.phone } : null}
      />
    </Container>
  );
}
