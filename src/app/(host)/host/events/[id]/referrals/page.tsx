import type { Metadata } from "next";
import { ApiError } from "@/lib/api";
import { requireUser } from "@/lib/session";
import {
  fetchEventAnalytics,
  fetchOwnEventDetail,
  fetchReferralLinks,
  fetchReferralStats,
  rankLinks,
  settle,
} from "@/lib/organizer";
import { ReferralManager } from "@/components/host/ReferralManager";

export const metadata: Metadata = { title: "Referrals" };

/**
 * Referral links and who sold what (#48, #51). Links can be renamed and
 * disabled after the event ends; new ones only while it's a draft or live.
 */
export default async function HostEventReferralsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [event, links, stats, detail] = await Promise.all([
    settle(fetchEventAnalytics(id)),
    settle(fetchReferralLinks(id)),
    settle(fetchReferralStats(id)),
    settle(fetchOwnEventDetail(id)),
  ]);
  // The layout renders the 404 / not-yours state.
  if (!event.ok) return null;
  for (const r of [links, stats]) {
    if (!r.ok) {
      if (r.error instanceof ApiError && (r.error.status === 403 || r.error.status === 404)) return null;
      throw r.error;
    }
  }
  if (!links.ok || !stats.ok) return null;

  const status = event.value.event.status;

  return (
    <ReferralManager
      eventId={id}
      eventEnd={detail.ok ? (detail.value?.event?.endTime ?? null) : null}
      canCreate={status === "DRAFT" || status === "PUBLISHED"}
      rows={rankLinks(stats.value, links.value)}
      stats={stats.value}
    />
  );
}
