import type { Metadata } from "next";
import { ApiError } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { fetchBeneficiaries, fetchEventAnalytics, settle } from "@/lib/organizer";
import { BeneficiaryManager } from "@/components/host/BeneficiaryManager";

export const metadata: Metadata = { title: "Revenue sharing" };

/**
 * Revenue sharing (#43): who gets a cut of this event's sales.
 * Ports `EventBeneficiariesScreen.js`.
 */
export default async function HostEventRevenueSharingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [event, partners] = await Promise.all([
    settle(fetchEventAnalytics(id)),
    settle(fetchBeneficiaries(id)),
  ]);
  // The layout renders the 404 / not-yours state.
  if (!event.ok) return null;
  if (!partners.ok) {
    if (partners.error instanceof ApiError && partners.error.status === 403) {
      return (
        <p className="rounded-card border border-dashed border-border px-5 py-10 text-center text-label text-text-faint">
          Only the event&apos;s organizer can manage its revenue partners.
        </p>
      );
    }
    throw partners.error;
  }

  return (
    <BeneficiaryManager
      eventId={id}
      eventStatus={event.value.event.status}
      selfId={user.id}
      initial={partners.value}
    />
  );
}
