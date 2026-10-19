import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { serverFetch } from "@/lib/api-server";
import { fetchEventBySlug, fetchPublicStalls } from "@/lib/crowdpass";
import { formatDate } from "@/lib/format";
import { isProvisionalName } from "@/lib/names";
import { getCurrentUser } from "@/lib/session";
import { loginUrlFor } from "@/lib/session-token";
import { APPLICATION_STATUS } from "@/lib/vendors";
import { ArrowLeftIcon } from "@/components/icons";
import { Badge, ButtonLink, Card, Container } from "@/components/ui";
import type { ApiVendorApplication } from "@/types/api";
import { ApplyForm } from "./ApplyForm";

type Params = { slug: string };

export const metadata: Metadata = {
  title: "Apply for a stall",
  robots: { index: false, follow: false },
};

/**
 * The vendor application form (#43). Sign-in required — not for the API's
 * sake alone: a vendor comes back days later to pay and collect passes, and
 * that needs an account to come back to. Phone-only accounts work too.
 *
 * Not in the proxy's matcher (it sits under the public `/events/*`), so the
 * sign-in redirect is made here.
 */
export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ stall?: string }>;
}) {
  const { slug } = await params;
  const { stall } = await searchParams;

  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect(loginUrlFor(`/events/${slug}/apply${stall ? `?stall=${encodeURIComponent(stall)}` : ""}`));

  let event;
  let stalls;
  try {
    [event, stalls] = await Promise.all([fetchEventBySlug(slug), fetchPublicStalls(slug)]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // One application per vendor per event; a withdrawn one may apply again.
  const mine = await serverFetch<ApiVendorApplication[]>("/vendor-applications/mine").catch(() => null);
  const existing = mine?.find((a) => a.event.id === event.id && a.status !== "WITHDRAWN") ?? null;

  const open = stalls.registration.acceptingApplications;
  const anyLeft = stalls.stallTypes.some((s) => s.remaining > 0);

  return (
    <main className="flex flex-1 flex-col pb-16">
      <Container className="flex flex-col gap-6 pt-6 lg:pt-12">
        <header className="flex items-center gap-3">
          <Link
            href={`/events/${event.slug}`}
            aria-label="Back to event"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-text transition-colors hover:bg-surface-strong"
          >
            <ArrowLeftIcon />
          </Link>
          <h1 className="text-title font-bold text-text">Apply for a stall</h1>
        </header>
        <div>
          <p className="text-section font-bold text-text-dim text-balance">{event.name}</p>
          <p className="text-label text-text-faint">
            {formatDate(event.startTime)}
            {event.venue ? ` · ${event.venue}` : ""}
          </p>
        </div>

        {existing ? (
          <Card className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-body font-bold text-text">You&apos;ve already applied</p>
              <Badge tone={APPLICATION_STATUS[existing.status].tone}>
                {APPLICATION_STATUS[existing.status].label}
              </Badge>
            </div>
            <p className="text-label text-text-dim">
              {existing.businessName} · {existing.stallType.name}. One application per
              event — open it to see where it stands.
            </p>
            <ButtonLink href={`/vendor-applications/${existing.id}`} size="sm" className="w-full sm:w-fit">
              View my application
            </ButtonLink>
          </Card>
        ) : !open || !anyLeft ? (
          <Card className="flex flex-col gap-3 p-4">
            <p className="text-body font-bold text-text">
              {open ? "Every stall has been taken" : "Vendor applications are closed"}
            </p>
            <p className="text-label text-text-dim">
              {open
                ? "All the stalls at this event are spoken for."
                : "This event isn't taking vendor applications right now."}
            </p>
            <ButtonLink href={`/events/${event.slug}`} variant="secondary" size="sm" className="w-full sm:w-fit">
              Back to the event
            </ButtonLink>
          </Card>
        ) : (
          <ApplyForm
            eventId={event.id}
            stalls={stalls.stallTypes}
            currency={event.currency || "NGN"}
            initialStall={stalls.stallTypes.find((s) => s.id === stall && s.remaining > 0)?.id ?? null}
            prefill={{
              contactName: isProvisionalName(user) ? "" : [user.firstName, user.lastName].filter(Boolean).join(" "),
              email: user.email,
              phone: user.phone,
            }}
          />
        )}
      </Container>
    </main>
  );
}
