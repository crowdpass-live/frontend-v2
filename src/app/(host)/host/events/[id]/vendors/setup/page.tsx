import type { Metadata } from "next";
import { ApiError } from "@/lib/api";
import { requireUser } from "@/lib/session";
import {
  fetchEventAnalytics,
  fetchOwnEventDetail,
  fetchStallTypes,
  fetchVendorRegistration,
  settle,
} from "@/lib/organizer";
import { VendorSetup } from "@/components/host/VendorSetup";

export const metadata: Metadata = { title: "Stalls & registration" };

/**
 * The stalls vendors can apply for, and the switch that takes applications
 * (#42). Ended and cancelled events show their stalls read-only.
 */
export default async function HostEventVendorSetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [event, stalls, registration, detail] = await Promise.all([
    settle(fetchEventAnalytics(id)),
    settle(fetchStallTypes(id)),
    settle(fetchVendorRegistration(id)),
    settle(fetchOwnEventDetail(id)),
  ]);
  // The layout renders the 404 / not-yours state.
  if (!event.ok) return null;
  if (!stalls.ok) {
    if (stalls.error instanceof ApiError && stalls.error.status === 403) return null;
    throw stalls.error;
  }

  const status = event.value.event.status;
  const editable = status === "DRAFT" || status === "PUBLISHED";

  return (
    <VendorSetup
      eventId={id}
      eventEnd={detail.ok ? (detail.value?.event?.endTime ?? null) : null}
      editable={editable}
      initialStalls={stalls.value}
      // An admin (not the owner) can't read the event row through the
      // organizer's own list; they get the stalls without the switch.
      initialRegistration={registration.ok ? registration.value : null}
    />
  );
}
